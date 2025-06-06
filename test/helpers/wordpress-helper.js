import axios from 'axios';
import { strict as assert } from 'assert';

export class WordPressHelper {
  constructor(baseURL, username, password) {
    this.baseURL = baseURL || process.env.WORDPRESS_URL || 'http://localhost:8080';
    this.username = username || process.env.WORDPRESS_USERNAME;
    this.password = password || process.env.WORDPRESS_PASSWORD;
    
    assert.ok(this.username, 'WordPress username is required');
    assert.ok(this.password, 'WordPress password is required');
    
    this.client = axios.create({
      baseURL: this.baseURL,
      auth: {
        username: this.username,
        password: this.password
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  async createPost(postData) {
    try {
      const response = await this.client.post('/wp-json/wp/v2/posts', postData);
      return response.data;
    } catch (error) {
      console.error('Error creating post:', error.response?.data || error.message);
      throw error;
    }
  }
  
  async getPost(id) {
    try {
      const response = await this.client.get(`/wp-json/wp/v2/posts/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error getting post:', error.response?.data || error.message);
      throw error;
    }
  }
  
  async deletePost(id, force = true) {
    try {
      const response = await this.client.delete(
        `/wp-json/wp/v2/posts/${id}`, 
        { params: { force } }
      );
      return response.data;
    } catch (error) {
      console.error('Error deleting post:', error.response?.data || error.message);
      throw error;
    }
  }
  
  async cleanUpPosts() {
    try {
      const response = await this.client.get('/wp-json/wp/v2/posts?per_page=100');
      const posts = response.data;
      
      for (const post of posts) {
        await this.deletePost(post.id);
      }
      
      return { deleted: posts.length };
    } catch (error) {
      console.error('Error cleaning up posts:', error.response?.data || error.message);
      throw error;
    }
  }
}

export default WordPressHelper;
