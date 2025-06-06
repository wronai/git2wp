import axios from 'axios';
import { jest } from '@jest/globals';
import WordPressService from '../../src/services/wordpress.service.js';

// Mock axios
jest.mock('axios');

// Mock the WordPressService module
jest.unstable_mockModule('../../src/services/wordpress.service.js', () => {
  return {
    default: jest.fn().mockImplementation((baseUrl, username, token) => {
      return {
        baseUrl,
        username,
        token,
        // Add mock implementations of methods you want to test
      };
    })
  };
});

describe('WordPressService', () => {
  let wordpressService;
  const baseUrl = 'http://example.com';
  const username = 'testuser';
  const password = 'testpass';
  const token = 'testtoken';

  beforeEach(() => {
    // Create a new instance before each test
    wordpressService = new WordPressService(baseUrl, username, token);
    // Clear all mock calls and instances before each test
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided credentials', () => {
      expect(wordpressService.baseUrl).toBe(baseUrl);
      expect(wordpressService.username).toBe(username);
      expect(wordpressService.token).toBe(token);
    });

    it('should initialize with empty token if not provided', () => {
      const service = new WordPressService(baseUrl, username);
      expect(service.token).toBe('');
    });
  });

  describe('testConnection', () => {
    it('should successfully connect to WordPress', async () => {
      const mockResponse = {
        data: [],
        headers: {
          'x-wp-total': '10'
        }
      };
      
      axios.get.mockResolvedValue(mockResponse);

      const result = await wordpressService.testConnection();

      expect(axios.get).toHaveBeenCalledWith(
        `${baseUrl}/wp-json/wp/v2/posts`,
        {
          auth: {
            username,
            password: token
          },
          params: {
            per_page: 1,
            page: 1
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      expect(result).toEqual({
        success: true,
        postsCount: '10',
        message: 'Successfully connected to WordPress'
      });
    });

    it('should handle connection error', async () => {
      const errorMessage = 'Connection failed';
      axios.get.mockRejectedValue({
        response: {
          data: { message: errorMessage }
        }
      });

      const result = await wordpressService.testConnection();

      expect(result).toEqual({
        success: false,
        error: errorMessage
      });
    });
  });

  describe('createPost', () => {
    const postData = {
      title: 'Test Post',
      content: 'Test Content',
      status: 'draft'
    };

    it('should create a new post successfully', async () => {
      const mockResponse = {
        data: {
          id: 123,
          link: 'http://example.com/test-post',
          title: { rendered: 'Test Post' },
          content: { rendered: 'Test Content' },
          status: 'draft'
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await wordpressService.createPost(
        postData.title,
        postData.content,
        postData.status
      );

      expect(axios.post).toHaveBeenCalledWith(
        `${baseUrl}/wp-json/wp/v2/posts`,
        {
          title: postData.title,
          content: postData.content,
          status: postData.status
        },
        {
          auth: {
            username,
            password: token
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      expect(result).toEqual({
        success: true,
        postId: mockResponse.data.id,
        link: mockResponse.data.link,
        message: 'Post created successfully'
      });
    });

    it('should handle post creation error', async () => {
      const errorMessage = 'Failed to create post';
      axios.post.mockRejectedValue({
        response: {
          data: { message: errorMessage }
        }
      });

      const result = await wordpressService.createPost(
        postData.title,
        postData.content,
        postData.status
      );

      expect(result).toEqual({
        success: false,
        error: errorMessage
      });
    });
  });

  describe('setToken', () => {
    it('should update the token', () => {
      const newToken = 'newtesttoken';
      wordpressService.setToken(newToken);
      expect(wordpressService.token).toBe(newToken);
    });
  });
});
