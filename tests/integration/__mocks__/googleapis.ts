// Mock Google APIs for integration testing

export const google = {
  auth: {
    GoogleAuth: jest.fn().mockImplementation(() => ({
      getClient: jest.fn().mockResolvedValue({
        // Mock auth client
      })
    }))
  },
  drive: jest.fn().mockImplementation(() => ({
    files: {
      create: jest.fn().mockResolvedValue({
        data: {
          id: 'mock-file-id-12345',
          name: 'test-file.jpg',
          webViewLink: 'https://drive.google.com/file/mock-file-id-12345/view',
          webContentLink: 'https://drive.google.com/uc?id=mock-file-id-12345'
        }
      }),
      get: jest.fn().mockResolvedValue({
        data: {
          id: 'mock-file-id-12345',
          name: 'test-file.jpg',
          mimeType: 'image/jpeg',
          size: '1024',
          webViewLink: 'https://drive.google.com/file/mock-file-id-12345/view'
        }
      }),
      list: jest.fn().mockResolvedValue({
        data: {
          files: [
            {
              id: 'mock-file-id-1',
              name: 'test-file-1.jpg',
              mimeType: 'image/jpeg'
            },
            {
              id: 'mock-file-id-2', 
              name: 'test-file-2.jpg',
              mimeType: 'image/jpeg'
            }
          ]
        }
      }),
      delete: jest.fn().mockResolvedValue({ data: {} }),
      permissions: {
        create: jest.fn().mockResolvedValue({ data: {} })
      }
    },
    permissions: {
      create: jest.fn().mockResolvedValue({ data: {} })
    }
  }))
};

// Mock service account auth
export const mockServiceAccount = {
  type: 'service_account',
  project_id: 'mock-project',
  private_key_id: 'mock-key-id',
  private_key: '-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END PRIVATE KEY-----\n',
  client_email: 'mock-service@mock-project.iam.gserviceaccount.com',
  client_id: 'mock-client-id',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/mock-service%40mock-project.iam.gserviceaccount.com'
};

// Helper to reset all mocks
export const resetGoogleDriveMocks = () => {
  jest.clearAllMocks();
};

// Helper to simulate Google Drive API errors
export const mockGoogleDriveError = (method: string, error: any) => {
  const mockImplementation = jest.fn().mockRejectedValue(error);
  
  switch (method) {
    case 'files.create':
      google.drive().files.create = mockImplementation;
      break;
    case 'files.get':
      google.drive().files.get = mockImplementation;
      break;
    case 'files.list':
      google.drive().files.list = mockImplementation;
      break;
    case 'files.delete':
      google.drive().files.delete = mockImplementation;
      break;
    default:
      throw new Error(`Unknown Google Drive method: ${method}`);
  }
};