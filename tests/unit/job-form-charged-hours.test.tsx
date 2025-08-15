// Tests for charged hours calculation logic
describe('Charged Hours Calculation Logic', () => {
  // Test the calculation logic directly
  const calculateChargedHours = (startTime: string, finishTime: string): number => {
    if (!startTime || !finishTime) return 0
    
    const start = new Date(`1970-01-01T${startTime.padStart(5, '0')}:00`)
    const finish = new Date(`1970-01-01T${finishTime.padStart(5, '0')}:00`)
    
    // Handle overnight shifts
    if (finish < start) {
      finish.setDate(finish.getDate() + 1)
    }
    
    const diffMs = finish.getTime() - start.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    
    return diffHours > 0 ? Math.round(diffHours * 100) / 100 : 0
  }

  it('calculates regular daytime shift correctly', () => {
    const result = calculateChargedHours('08:00', '16:30')
    expect(result).toBe(8.5)
  })

  it('calculates overnight shift correctly', () => {
    const result = calculateChargedHours('22:00', '06:00')
    expect(result).toBe(8)
  })

  it('calculates hours with 2 decimal precision', () => {
    const result = calculateChargedHours('08:00', '16:15')
    expect(result).toBe(8.25)
  })

  it('calculates fractional hours correctly', () => {
    const result = calculateChargedHours('09:30', '17:45')
    expect(result).toBe(8.25)
  })

  it('handles edge case of same time (0 hours)', () => {
    const result = calculateChargedHours('08:00', '08:00')
    expect(result).toBe(0)
  })

  it('handles edge case at midnight boundary', () => {
    const result = calculateChargedHours('23:00', '01:00')
    expect(result).toBe(2)
  })

  it('returns 0 for missing start time', () => {
    const result = calculateChargedHours('', '16:00')
    expect(result).toBe(0)
  })

  it('returns 0 for missing finish time', () => {
    const result = calculateChargedHours('08:00', '')
    expect(result).toBe(0)
  })

  it('handles short time format correctly', () => {
    const result = calculateChargedHours('8:00', '16:30')
    expect(result).toBe(8.5)
  })
})

