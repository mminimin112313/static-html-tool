// js/promptService.js

// Gemini API 설정: 이 부분에서 모델명이나 API 버전을 쉽게 변경할 수 있습니다.
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const GEMINI_MODEL = 'gemini-2.5-pro';

/**
 * @class PromptService
 * @description Gemini API 요청을 위한 엔드포인트와 페이로드를 생성합니다.
 */
export class PromptService {
  constructor() {
    this.baseUrl = GEMINI_API_BASE_URL;
    this.model = GEMINI_MODEL;
  }

  /**
   * 블로그 게시물 생성을 위한 API 요청 객체를 빌드합니다.
   * @param {string} template - 메인 프롬프트 템플릿
   * @param {string} topic - 생성할 주제
   * @returns {{endpoint: string, payload: object}} API 호출에 필요한 엔드포인트와 페이로드
   */
  buildBlogGenerationPayload(template, topic) {
    const endpoint = `${this.baseUrl}${this.model}`;
    
    // Gemini API가 요구하는 'contents' 형식으로 페이로드를 구성합니다.
    const payload = {
      contents: [
        {
          parts: [{ text: template.replace('{{TOPIC}}', topic) }],
        },
      ],
      // (필요시) 여기에 generationConfig (temperature 등)를 추가할 수 있습니다.
      // generationConfig: {
      //   temperature: 0.7,
      // }
    };

    return { endpoint, payload };
  }

  /**
   * (추후 확장 가능) 후속 작업(예: 요약, 번역)을 위한 페이로드를 빌드합니다.
   * @param {string} followUpTemplate - 후속 작업 템플릿
   * @param {string} originalContent - 원본 콘텐츠
   * @returns {{endpoint: string, payload: object}}
   */
  buildFollowUpPayload(followUpTemplate, originalContent) {
    const endpoint = `${this.baseUrl}${this.model}`;
    
    const payload = {
      contents: [
        {
          parts: [{ text: followUpTemplate.replace('{{CONTENT}}', originalContent) }],
        },
      ],
    };

    return { endpoint, payload };
  }
}