import {
  getJobDay,
  getTollRoad,
  matchTollTripsToJobs,
  normaliseRegistration,
  type MatchableJob,
  type MatchableTollTrip,
} from "@/lib/tolls/toll-matching";

function makeJob({ ...overrides }: Partial<MatchableJob>): MatchableJob {
  return {
    id: 1,
    date: "2026-10-02T00:00:00.000Z",
    registration: "1EA6QC",
    startTime: null,
    finishTime: null,
    citylink: null,
    eastlink: null,
    ...overrides,
  };
}

function makeTrip({ ...overrides }: Partial<MatchableTollTrip>): MatchableTollTrip {
  return {
    id: 100,
    registration: "1EA6QC",
    tripStart: "2026-10-02T09:00:00.000Z",
    tripDetails: "Punt Rd to Monash Fwy/Toorak Rd",
    amount: 20.44,
    ...overrides,
  };
}

describe("getTollRoad", () => {
  it("treats the EL prefix as EastLink and the rest as CityLink", () => {
    expect(getTollRoad({ tripDetails: "EL Police Rd to Melba Tunnel" })).toBe("eastlink");
    expect(getTollRoad({ tripDetails: "West Gate Fwy to City South" })).toBe("citylink");
    expect(getTollRoad({ tripDetails: "Exhibition St to Swan St" })).toBe("citylink");
  });
});

describe("normaliseRegistration", () => {
  it("ignores case, spaces and punctuation", () => {
    expect(normaliseRegistration({ registration: " xw-36 ni " })).toBe("XW36NI");
  });
});

describe("getJobDay", () => {
  it("uses the start time when set", () => {
    expect(
      getJobDay({ job: { date: "2026-10-01T14:00:00.000Z", startTime: "2026-10-02T06:00:00.000Z" } }),
    ).toBe("2026-10-02");
  });

  it("rounds a Melbourne-midnight date to the right day", () => {
    expect(getJobDay({ job: { date: "2026-09-18T14:00:00.000Z", startTime: null } })).toBe(
      "2026-09-19",
    );
    expect(getJobDay({ job: { date: "2026-09-19T00:00:00.000Z", startTime: null } })).toBe(
      "2026-09-19",
    );
  });
});

describe("matchTollTripsToJobs", () => {
  it("matches a trip to its vehicle's job that day", () => {
    const { matches } = matchTollTripsToJobs({
      trips: [makeTrip({ registration: "1ea 6qc" })],
      jobs: [makeJob({ id: 7 })],
    });

    expect(matches).toEqual([{ tripId: 100, status: "matched", jobId: 7 }]);
  });

  it("flags trips with no job and trips with no known vehicle", () => {
    const { matches } = matchTollTripsToJobs({
      trips: [
        makeTrip({ id: 1, tripStart: "2026-10-03T09:00:00.000Z" }),
        makeTrip({ id: 2, registration: null }),
      ],
      jobs: [makeJob({})],
    });

    expect(matches).toEqual([
      { tripId: 1, status: "no-job", jobId: null },
      { tripId: 2, status: "unknown-vehicle", jobId: null },
    ]);
  });

  it("picks the job whose time window is closest when a vehicle did several", () => {
    const morning = makeJob({
      id: 1,
      startTime: "2026-10-02T06:00:00.000Z",
      finishTime: "2026-10-02T10:00:00.000Z",
    });
    const afternoon = makeJob({
      id: 2,
      startTime: "2026-10-02T12:00:00.000Z",
      finishTime: "2026-10-02T16:00:00.000Z",
    });

    const { matches } = matchTollTripsToJobs({
      trips: [
        makeTrip({ id: 10, tripStart: "2026-10-02T07:42:00.000Z" }),
        makeTrip({ id: 11, tripStart: "2026-10-02T14:57:00.000Z" }),
        makeTrip({ id: 12, tripStart: "2026-10-02T11:20:00.000Z" }),
      ],
      jobs: [morning, afternoon],
    });

    expect(matches.map((match) => match.jobId)).toEqual([1, 2, 2]);
  });

  it("flags jobs whose recorded toll counts differ from Linkt", () => {
    const { reconciliation } = matchTollTripsToJobs({
      trips: [
        makeTrip({ id: 1, amount: 20.44 }),
        makeTrip({ id: 2, amount: 7.11, tripDetails: "EL Thompson Rd to Dandenong Bypass" }),
        makeTrip({ id: 3, amount: 38.32, registration: "DXD017" }),
      ],
      jobs: [
        makeJob({ id: 1, citylink: 1, eastlink: 1 }),
        makeJob({ id: 2, registration: "DXD017", citylink: 2 }),
        makeJob({ id: 3, registration: "CTJ450" }),
      ],
    });

    expect(reconciliation).toEqual([
      {
        jobId: 1,
        jobDay: "2026-10-02",
        recordedCitylink: 1,
        recordedEastlink: 1,
        actualCitylink: 1,
        actualEastlink: 1,
        tollCost: 27.55,
        isMismatch: false,
      },
      {
        jobId: 2,
        jobDay: "2026-10-02",
        recordedCitylink: 2,
        recordedEastlink: 0,
        actualCitylink: 1,
        actualEastlink: 0,
        tollCost: 38.32,
        isMismatch: true,
      },
    ]);
  });
});

describe("matchTollTripsToJobs with overnight jobs", () => {
  const dayJob = makeJob({
    id: 1,
    startTime: "2026-10-02T06:00:00.000Z",
    finishTime: "2026-10-02T14:00:00.000Z",
  });
  const nightJob = makeJob({
    id: 2,
    startTime: "2026-10-02T22:00:00.000Z",
    finishTime: "2026-10-02T06:00:00.000Z",
  });

  it("treats a finish before the start as the next morning", () => {
    const { matches } = matchTollTripsToJobs({
      trips: [makeTrip({ id: 10, tripStart: "2026-10-02T23:00:00.000Z" })],
      jobs: [dayJob, nightJob],
    });

    expect(matches[0].jobId).toBe(2);
  });

  it("matches a trip after midnight to the previous night's job", () => {
    const { matches, reconciliation } = matchTollTripsToJobs({
      trips: [makeTrip({ id: 11, tripStart: "2026-10-03T02:30:00.000Z" })],
      jobs: [dayJob, nightJob],
    });

    expect(matches[0]).toEqual({ tripId: 11, status: "matched", jobId: 2 });
    expect(reconciliation.find((row) => row.jobId === 2)?.actualCitylink).toBe(1);
  });

  it("gives a morning trip to the next day's job when both cover it", () => {
    const morningJob = makeJob({
      id: 3,
      date: "2026-10-03T00:00:00.000Z",
      startTime: "2026-10-03T06:00:00.000Z",
      finishTime: "2026-10-03T14:00:00.000Z",
    });

    const { matches } = matchTollTripsToJobs({
      trips: [makeTrip({ id: 13, tripStart: "2026-10-03T06:30:00.000Z" })],
      jobs: [nightJob, morningJob],
    });

    expect(matches[0].jobId).toBe(3);
  });

  it("does not carry a daytime job over to the next day", () => {
    const { matches } = matchTollTripsToJobs({
      trips: [makeTrip({ id: 12, tripStart: "2026-10-03T09:00:00.000Z" })],
      jobs: [dayJob, nightJob],
    });

    expect(matches[0].status).toBe("no-job");
  });
});
