const axios = require('axios');
const { PanoptoClient } = require('../Panopto/client.js');

class CanvasClient {
  constructor({ university, authToken }) {
    this.university = university;
    this.serverUrl = `https://${university}.instructure.com`;
    this.authToken = authToken;
    this.api = axios.create({
      baseURL: `${this.serverUrl}/api/v1`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  createIdentifier(courseId, documentId) {
    return `canvas-${this.university}-${courseId}-${documentId}`;
  }

  async getCourses() {
    try {
      const { data } = await this.api.get('/courses?include[]=syllabus_body');
      return data.map(course => ({
        id: course.id,
        name: course.name,
        code: course.course_code,
        syllabus: course.syllabus_body,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Canvas courses: ${error.message}`);
    }
  }

  async getModules(courseId) {
    try {
      const { data } = await this.api.get(`/courses/${courseId}/modules?include[]=items`);
      return data;
    } catch (error) {
      throw new Error(`Failed to fetch course modules: ${error.message}`);
    }
  }

  async getPages(courseId) {
    try {
      const { data } = await this.api.get(`/courses/${courseId}/pages`);
      return data;
    } catch (error) {
      throw new Error(`Failed to fetch course pages: ${error.message}`);
    }
  }

  async getPageContent(courseId, pageUrl) {
    try {
      const { data } = await this.api.get(`/courses/${courseId}/pages/${pageUrl}`);
      return data.body;
    } catch (error) {
      throw new Error(`Failed to fetch page content: ${error.message}`);
    }
  }

  async getFiles(courseId) {
    try {
      const { data } = await this.api.get(`/courses/${courseId}/files`);
      return data;
    } catch (error) {
      throw new Error(`Failed to fetch course files: ${error.message}`);
    }
  }

  async downloadFile(fileUrl) {
    try {
      const { data } = await axios.get(fileUrl, {
        headers: { 'Authorization': `Bearer ${this.authToken}` },
        responseType: 'arraybuffer'
      });
      return data;
    } catch (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  async getPanoptoConfig(courseId) {
    try {
      const { data } = await this.api.get(`/courses/${courseId}/external_tools`);
      const panoptoTool = data.find(tool => 
        tool.name.toLowerCase().includes('panopto') || 
        tool.domain.includes('panopto')
      );
      
      if (!panoptoTool) {
        throw new Error('Panopto tool not found in course external tools');
      }

      return {
        toolId: panoptoTool.id,
        launchUrl: panoptoTool.url,
        domain: panoptoTool.domain
      };
    } catch (error) {
      throw new Error(`Failed to get Panopto configuration: ${error.message}`);
    }
  }

  async getPanoptoLaunchParams(courseId, toolId) {
    try {
      const { data } = await this.api.get(
        `/courses/${courseId}/external_tools/${toolId}/retrieve`
      );
      return data;
    } catch (error) {
      throw new Error(`Failed to get Panopto LTI parameters: ${error.message}`);
    }
  }

  async getPanoptoVideos(courseId) {
    try {
      // 1. Get Panopto tool configuration
      const panoptoConfig = await this.getPanoptoConfig(courseId);
      
      // 2. Get LTI launch parameters
      const ltiParams = await this.getPanoptoLaunchParams(courseId, panoptoConfig.toolId);
      
      // 3. Extract Panopto auth token from LTI response
      const panoptoAuthToken = ltiParams.custom_panopto_auth_token || 
                              ltiParams.custom_panopto_token;
      
      if (!panoptoAuthToken) {
        throw new Error('Could not obtain Panopto authentication token');
      }

      // 4. Initialize Panopto client with LTI credentials
      const panoptoClient = new PanoptoClient({
        university: this.university,
        authToken: panoptoAuthToken,
        serverUrl: `https://${panoptoConfig.domain}`
      });

      // 5. Get course folder ID from LTI params
      const folderId = ltiParams.custom_panopto_folder_id;
      
      // 6. Get videos using Panopto client
      return await panoptoClient.getVideos(folderId);

    } catch (error) {
      throw new Error(`Failed to get Panopto videos: ${error.message}`);
    }
  }
}

module.exports = { CanvasClient }; 