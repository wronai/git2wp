// @ts-check
import { test, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/api.helper.js';

test.describe('Git Repositories API', () => {
  let apiHelper;

  test.beforeEach(async ({ request }) => {
    apiHelper = new ApiHelper(request);
  });

  test('should return list of git repositories', async () => {
    // Act
    const response = await apiHelper.get('/git/repos');
    
    // Assert
    expect(Array.isArray(response.repositories)).toBeTruthy();
    
    // Verify repository structure if there are any repositories
    if (response.repositories.length > 0) {
      const repo = response.repositories[0];
      expect(repo).toHaveProperty('path');
      expect(repo).toHaveProperty('name');
      expect(repo).toHaveProperty('commits');
      expect(Array.isArray(repo.commits)).toBeTruthy();
    }
  });

  test('should return repository details with commits', async () => {
    // Arrange - Get the list of repositories first
    const reposResponse = await apiHelper.get('/git/repos');
    
    // Skip test if no repositories are available
    test.skip(reposResponse.repositories.length === 0, 'No repositories available for testing');
    
    const testRepo = reposResponse.repositories[0];
    
    // Act - Get repository details
    const repoDetails = await apiHelper.get(`/git/repo/${encodeURIComponent(testRepo.path)}`);
    
    // Assert
    expect(repoDetails).toHaveProperty('path', testRepo.path);
    expect(repoDetails).toHaveProperty('name', testRepo.name);
    expect(repoDetails).toHaveProperty('commits');
    expect(Array.isArray(repoDetails.commits)).toBeTruthy();
    
    // Verify commit structure if there are any commits
    if (repoDetails.commits.length > 0) {
      const commit = repoDetails.commits[0];
      expect(commit).toHaveProperty('hash');
      expect(commit).toHaveProperty('message');
      expect(commit).toHaveProperty('author');
      expect(commit).toHaveProperty('date');
    }
  });

  test('should return 404 for non-existent repository', async () => {
    // Act & Assert
    const response = await apiHelper.request.get('/git/repo/nonexistent-repo');
    expect(response.status()).toBe(404);
    
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('not found');
  });

  test('should return commits for a specific date range', async () => {
    // Arrange - Get the list of repositories first
    const reposResponse = await apiHelper.get('/git/repos');
    test.skip(reposResponse.repositories.length === 0, 'No repositories available for testing');
    
    const testRepo = reposResponse.repositories[0];
    const today = new Date().toISOString().split('T')[0];
    const params = {
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      until: today
    };
    
    // Act
    const commits = await apiHelper.get(
      `/git/repo/${encodeURIComponent(testRepo.path)}/commits`,
      params
    );
    
    // Assert
    expect(Array.isArray(commits)).toBeTruthy();
    
    // If there are commits, verify their structure
    if (commits.length > 0) {
      const commit = commits[0];
      expect(commit).toHaveProperty('hash');
      expect(commit).toHaveProperty('message');
      expect(commit).toHaveProperty('author');
      expect(commit).toHaveProperty('date');
      
      // Verify the date is within the specified range
      const commitDate = new Date(commit.date).getTime();
      const sinceDate = new Date(params.since).getTime();
      const untilDate = new Date(params.until).getTime();
      
      expect(commitDate).toBeGreaterThanOrEqual(sinceDate);
      expect(commitDate).toBeLessThanOrEqual(untilDate + (24 * 60 * 60 * 1000)); // Add 1 day to until date
    }
  });
});
