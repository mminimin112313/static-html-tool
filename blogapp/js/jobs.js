/**
 * ================================================================
 * 클래스 3: JobManager - 작업 큐, API 키 상태, API 호출 전담
 * (Axiom: Algorithmic Efficiency, SOLID Architecture)
 * ================================================================
 */
export default class JobManager {
  constructor(app) {
    this.app = app;
this.jobQueue = [];
    this.apiKeys = []; // Firebase로부터 실시간 동기화됨
    this.activelyProcessingJobs = new Map();
this.keyUsageTimestamps = new Map(); // ✨ [신규] 키별 호출 기록 (메모리)
    
    this.jobDispatcherInterval = null;
this.totalJobsAtStart = 0;
    this.jobIdCounter = 0;
    this.KEY_FAILURE_COOLDOWN_MS = 60000; // 1분 (실패 시 휴식 시간)
    this.MAX_FAILURE_COUNT = 5;
}
  
  // 1. 작업 큐 관리
  addJobs(jobs) {
    this.jobQueue.push(...jobs);
    this.totalJobsAtStart += jobs.length;
    this.updateUIStatus();
}
  
  addRetryJob(job, isFollowUp = false) {
    this.jobQueue.push(job);
// 실패한 작업은 우선순위가 낮게 뒤로 감
    this.totalJobsAtStart++;
    this.updateUIStatus();
}
  
  getNextJob() {
    return this.jobQueue.shift();
}
  
  // 2. API 키 상태 관리
  updateApiKeys(keys) {
    this.apiKeys = keys;
}
  
  // [ blogapp/js/jobs.js ]

  getAvailableKeys() {
    const now = Date.now();
const potentiallyReadyKeys = [];
    const keysToRecover = []; // Firestore 상태 업데이트가 필요한 키

    // --- 1차 필터링: Firestore 상태 확인 (cooldown/busy 복구 포함) ---
    for (const key of this.apiKeys) {
        if (key.status === 'ready') {
            potentiallyReadyKeys.push(key);
continue; // 1차 통과
        }

        if (key.status === 'cooldown' || key.status === 'busy') {
            const lastUsed = key.lastUsed?.toMillis() ||
0;
            
            if (lastUsed === 0 && key.status !== 'ready') {
                // 'cooldown' 또는 'busy' 상태인데 lastUsed 타임스탬프가 없는 비정상 상태
                keysToRecover.push(key);
key.status = 'ready'; // 1. 로컬 상태 즉시 변경
                potentiallyReadyKeys.push(key);
// 1차 통과
                continue;
}

            const elapsed = now - lastUsed;
if (elapsed > this.KEY_FAILURE_COOLDOWN_MS) { // 60초 이상 휴식/멈춤
                keysToRecover.push(key);
key.status = 'ready'; // 1. 로컬 상태 즉시 변경
                potentiallyReadyKeys.push(key);
// 1차 통과
            }
            continue;
}
        // 'dead' 상태의 키는 무시됨
    }

    // Firestore 상태를 비동기적으로 업데이트 (non-blocking)
    if (keysToRecover.length > 0) {
        this.recoverKeys(keysToRecover);
}
    
    // --- ✨ [신규] 2차 필터링: 분당 2회 호출 제한 (메모리 캐시) ---
    const trulyReadyKeys = potentiallyReadyKeys.filter(key => {
        const timestamps = this.keyUsageTimestamps.get(key.id) || [];
        // 1분 이내의 타임스탬프만 필터링
        const validTimestamps = timestamps.filter(t => (now - t) < 60000);
        
        // (Pruning: 필터링된 결과를 맵에 다시 저장)
       
 this.keyUsageTimestamps.set(key.id, validTimestamps); 

        // 1분 이내 기록이 2회 미만이면 통과
        return validTimestamps.length < 2;
    });
return trulyReadyKeys;
  }

  // 3. 디스패처 (메인 루프)
  start() {
    if (this.jobDispatcherInterval) return;
    console.log("JobManager 시작됨.");
// ✨ [복원] 1초 간격으로 디스패치
    this.jobDispatcherInterval = setInterval(() => this.dispatchJobs(), 1000);
// 1초마다 디스패처 실행
  }
  
  stop() {
    clearInterval(this.jobDispatcherInterval);
    this.jobDispatcherInterval = null;
    console.log("JobManager 중지됨.");
}
  
  // [ blogapp/js/jobs.js ]
  // [ blogapp/js/jobs.js ]
  async dispatchJobs() {
    this.updateUIStatus();
if (this.jobQueue.length === 0) {
      if (this.totalJobsAtStart > 0 && this.activelyProcessingJobs.size === 0) {
        this.app.ui.updateStatusMessage("모든 작업 완료!");
this.totalJobsAtStart = 0;
      }
      return;
    }

    const availableKeys = this.getAvailableKeys();
if (availableKeys.length === 0) {
      return;
// 사용 가능한 키 없음
    }

    // ✨ [복원] 사용 가능한 키 만큼 동시에 작업 처리
    const jobsToDispatch = Math.min(this.jobQueue.length, availableKeys.length);
for (let i = 0; i < jobsToDispatch; i++) {
      const key = availableKeys[i];
const job = this.getNextJob(); 

      // 상태 즉시 변경 (중복 할당 방지)
      key.status = 'busy';
// 로컬 상태 즉시 변경
      this.activelyProcessingJobs.set(job.jobId, job);
      this.updateUIStatus();

      this.app.ui.updateStatusMessage(`'${job.topic}' 작업 시작 (Key: ...${key.key.slice(-4)})...`);
// executeJob은 비동기지만 await하지 않음 (병렬 실행)
      this.executeJob(job, key);
}
  }

  // 4. 개별 작업 실행기 (Worker)
  // [ blogapp/js/jobs.js ]
  // 4. 개별 작업 실행기 (Worker)
  async executeJob(job, key) {
    let apiResponse = null;
try {
      // ✨ [신규] API 호출 직전에 로컬 타임스탬프 기록
      const now = Date.now();
const timestamps = this.keyUsageTimestamps.get(key.id) || [];
      // 1분 이상 지난 타임스탬프 제거 (Pruning)
      const validTimestamps = timestamps.filter(t => (now - t) < 60000);
validTimestamps.push(now);
      this.keyUsageTimestamps.set(key.id, validTimestamps);
      
      // Firestore에 'busy' 상태 즉시 업데이트
      await this.app.firebase.updateApiKeyStatus(key.id, 'busy');
// Gemini API 호출
      apiResponse = await this.callGeminiAPI(job.prompt, key.key);
if (apiResponse.success) {
        // --- 성공 ---
        // ✨ [수정] key.keykey 오타 수정
        this.app.ui.showToast(`'${job.topic}' 완료 (Key: ...${key.key.slice(-4)})`, "success");

        // ✨ [신규] 'initial' 작업인 경우, 새 Post ID를 받아옴
        let newPostId = null;
if (job.type === 'initial') {
          newPostId = await this.app.firebase.saveGeneratedPost(job, apiResponse.text, false);
        }
        
        // ✨ [신규] App 컨트롤러의 성공 핸들러 호출 (기본 이미지 추가 및 후속 작업 저장)
        await this.app.handleJobSuccess(job, newPostId, apiResponse.text);
// [기존 로직은 app.handleJobSuccess로 이동됨]
        
        // 성공: 즉시 '준비' 상태로 변경
        await this.app.firebase.updateApiKeyStatus(key.id, 'ready');
} else {
        // --- API 오류 (429, 4xx, 5xx 등) ---
        await this.handleJobFailure(job, key, apiResponse.error);
}
    } catch (error) {
      // --- 네트워크 오류 등 예외 처리 ---
      console.error("큐 처리 중 예외 발생:", error);
await this.handleJobFailure(job, key, `네트워크 오류: ${error.message}`);
      
    } finally {
      // 작업이 성공하든 실패하든, 처리 목록에서 제거
      this.activelyProcessingJobs.delete(job.jobId);
this.updateUIStatus();
    }
  }
  
  // 5. API 호출 (Fetch)
  async callGeminiAPI(prompt, apiKey) {
    // const MODEL_ID = "gemini-1.5-flash-latest";
// 또는 gemini-1.5-pro-latest
    const MODEL_ID = "gemini-2.5-pro";
    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${apiKey}`;
const payload = {
      contents: [{ role: "user", parts: [{ "text": prompt }] }],
      // generationConfig: { ... } // 필요 시 추가
      // safetySettings: { ... } // 필요 시 추가
    };
try {
      // 5xx 서버 오류에 대비한 fetch 재시도
      const response = await this.fetchWithBackoff(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
if (response.status === 429) {
        // 429 (Rate Limit)는 특별 취급 (handleJobFailure에서 처리)
        return { success: false, error: 'API 속도 제한 (429)' };
}
      
      if (!response.ok) {
        // 429 이외의 4xx, 5xx 오류
        const errBody = await response.text();
let errMessage = `API 오류 (${response.status})`;
        try { 
          // Gemini 오류 응답 파싱 시도
          errMessage = JSON.parse(errBody).error?.message ||
errBody; 
        } catch (e) { 
          errMessage = errBody.substring(0, 100) ||
'Unknown API Error'; 
        }
        return { success: false, error: errMessage };
}

      const result = await response.json();
if (!result.candidates || result.candidates.length === 0) {
        // API 호출은 성공했으나, 안전 필터 등에 의해 콘텐츠가 생성되지 않음
        const blockReason = result.promptFeedback?.blockReason;
const finishReason = result.candidates?.[0]?.finishReason;
        let error = 'API 응답에 후보 없음';
        if (blockReason) { error = `콘텐츠 생성 차단 (${blockReason})`;
}
        else if (finishReason && finishReason !== 'STOP') { error = `생성 중단 (${finishReason})`;
}
        return { success: false, error: error };
}

      const text = result.candidates[0].content?.parts?.[0]?.text;
if (typeof text !== 'string') {
         // 텍스트가 아닌 다른 타입(e.g., function call)이 반환되었거나, parts가 비어있음
         const finishReason = result.candidates[0].finishReason;
return { success: false, error: `API가 텍스트를 반환하지 않음 (이유: ${finishReason})` };
}
      
      return { success: true, text: text };
} catch (error) { 
      // fetch 자체의 네트워크 오류 (e.g., CORS, DNS, timeout)
      return { success: false, error: `네트워크 또는 Fetch 오류: ${error.message}` };
}
  }
  
  // 6. 5xx 서버 오류 재시도
  async fetchWithBackoff(url, options, retries = 3, delay = 1000) {
    try {
      const response = await fetch(url, options);
if (response.status === 429) { 
        return response;
// 429는 재시도하지 않고 즉시 반환
      }
      if (response.status >= 500 && retries > 0) {
        // 5xx 서버 오류일 경우 재시도
        throw new Error(`Server error ${response.status}`);
}
      return response;
    } catch (error) {
      if (retries > 0 && (error.message.includes('Server error') || error instanceof TypeError)) { // TypeError는 네트워크 오류일 수 있음
        this.app.ui.updateStatusMessage(`서버/네트워크 오류, ${delay / 1000}초 후 재시도...`);
await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithBackoff(url, options, retries - 1, delay * 2);
// Exponential backoff
      }
      throw error;
// 재시도 횟수 소진 시 오류 발생
    }
  }
  
  // 7. 작업 실패 처리
  // [ blogapp/js/jobs.js ]
  async handleJobFailure(job, key, errorMessage) {
    this.app.ui.showToast(`'${job.topic}' 작업 실패: ${errorMessage}`, "error");
// 1. Firestore에 작업 실패 결과 저장
    try {
      if (job.type === 'initial') {
        await this.app.firebase.saveGeneratedPost(job, `작업 실패: ${errorMessage}`, true);
} else if (job.type === 'follow-up') {
        await this.app.firebase.updatePostWithFollowUp(job, `작업 실패: ${errorMessage}`, true);
}
    } catch (saveError) { console.error("실패 상태 저장 중 오류:", saveError);
}

    // 2. 키 상태를 실패 횟수에 따라 업데이트
    
    // ✨ [유지] API 키가 유효하지 않으면(Invalid) 즉시 'dead' 상태로 변경
    if (errorMessage && errorMessage.includes('API key not valid')) {
      await this.app.firebase.updateApiKeyStatus(key.id, 'dead', { 
        failureCount: this.MAX_FAILURE_COUNT, // 실패 횟수를 최대로 설정
        status: 'dead' // 상태를 명확히 'dead'로 설정
      });
this.app.ui.showToast(`API 키 ...${key.key.slice(-4)}가 유효하지 않아 영구 비활성화됩니다.`, "error");
      return; // 'cooldown' 로직을 건너뜁니다.
}

    const newFailureCount = (key.failureCount || 0) + 1;
if (newFailureCount >= this.MAX_FAILURE_COUNT) {
      // 최대 실패 횟수 도달: 키를 'dead' 상태로 변경
      await this.app.firebase.updateApiKeyStatus(key.id, 'dead', { failureCount: newFailureCount });
this.app.ui.showToast(`API 키 ...${key.key.slice(-4)}가 ${this.MAX_FAILURE_COUNT}회 연속 실패하여 비활성화됩니다. '설정'에서 확인하세요.`, "error");
} else {
      // 1분 휴식 (getAvailableKeys가 1분 뒤 복구)
      await this.app.firebase.updateApiKeyStatus(key.id, 'cooldown', { failureCount: newFailureCount });
}
  }

  async recoverKeys(keys) {
    // Set을 사용해 중복 호출 방지 (각 키ID당 한 번만)
    const uniqueKeys = [...new Map(keys.map(k => [k.id, k])).values()];
console.log(`[JobManager] ${uniqueKeys.length}개의 만료된 키('cooldown'/'busy')를 'ready' 상태로 복구합니다.`);
    
    const recoveryPromises = uniqueKeys.map(key => 
        this.app.firebase.updateApiKeyStatus(key.id, 'ready')
            .catch(e => console.error(`[JobManager] Key ${key.id.slice(-4)} 복구 실패:`, e))
    );
// 작업이 디스패치 루프를 막지 않도록 백그라운드에서 실행
    await Promise.allSettled(recoveryPromises);
}

  // 8. UI 상태 업데이트
  updateUIStatus() {
    this.app.ui.updateJobFooter(this.activelyProcessingJobs, this.jobQueue.length);
if (this.app.ui.elements.statusMessage) {
      const done = this.totalJobsAtStart - this.jobQueue.length - this.activelyProcessingJobs.size;
if (this.totalJobsAtStart > 0) {
          this.app.ui.updateStatusMessage(`총 ${this.totalJobsAtStart}개 중 ${done}개 완료 (처리중: ${this.activelyProcessingJobs.size}, 대기: ${this.jobQueue.length})`);
} else {
          this.app.ui.updateStatusMessage('');
}
    }
  }
  
  // 9. Job ID 생성
  getNextJobId() {
    this.jobIdCounter++;
return `job-${Date.now()}-${this.jobIdCounter}`;
  }
}