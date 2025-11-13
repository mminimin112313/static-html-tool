/**
* ================================================================
* 클래스 5.5: VideoGenerator - (푸터 상태 업데이트 / DB 저장)
* ✨ [수정] 작업 큐(Queue) 및 디스패처 기능 추가
* ================================================================
*/
export default class VideoGenerator {
 constructor(app, appUI, imageDB) {
  this.app = app; // ✨ [신규] App 컨트롤러 인스턴스
  this.ui = appUI;
  this.imageDB = imageDB;
 
  this.canvas = document.createElement('canvas');
  this.canvas.width = 1280;
  this.canvas.height = 720;
  this.ctx = this.canvas.getContext('2d', {
   alpha: false,
   desynchronized: true
  });
 
  this.audioCtx = null;
  this.mediaRecorder = null;
  this.recordedChunks = [];
  this.videoStream = null;
  this.audioDestination = null;
  this.animationFrameId = null;
 
  this.isBusy = false;
  this.videoJobQueue = []; // ✨ [신규] 동영상 작업 큐
  this.currentJobPostId = null; // ✨ [신규] 현재 처리 중인 작업 ID
 
  console.log("[VideoGenerator] S_CONSTRUCT: VideoGenerator 인스턴스 생성됨.");
 }

 /**
 * [신규] 작업을 큐에 추가합니다. (App.js에서 호출)
 */
 queueJob(postId) {
  // 이미 큐에 있거나 처리 중인지 간단히 확인
  if (this.currentJobPostId === postId || this.videoJobQueue.includes(postId)) {
   this.ui.showToast(`'${postId.substring(0, 6)}...' 동영상 작업은 이미 대기 중입니다.`, "info");
   return;
  }
 
  this.videoJobQueue.push(postId);
  this.ui.showToast(`'${postId.substring(0, 6)}...' 동영상 작업을 큐에 추가했습니다. (총 ${this.videoJobQueue.length}개 대기)`, "info");
  this._updateFooterStatus("대기열 추가됨"); // 푸터 업데이트
  this._dispatch(); // 디스패처 실행
 }

 /**
 * [신규] 큐에서 다음 작업을 꺼내 처리합니다.
 */
 _dispatch() {
  if (this.isBusy) {
   console.log("[VideoGenerator] S_DISPATCH: 디스패처 호출됨 (Busy. 반환).");
   return; // 이미 작업 중
  }
  if (this.videoJobQueue.length === 0) {
   console.log("[VideoGenerator] S_DISPATCH: 디스패처 호출됨 (Queue Empty. 푸터 클리어).");
   this.currentJobPostId = null;
   this._updateFooterStatus("작업 없음"); // 푸터 클리어
   return; // 큐 비어있음
  }

  this.isBusy = true;
  this.currentJobPostId = this.videoJobQueue.shift();
  
  console.log(`[VideoGenerator] S_DISPATCH: 다음 작업 시작 (PostID: ${this.currentJobPostId}). 대기열: ${this.videoJobQueue.length}개`);
  this._updateFooterStatus("디스패치 시작"); // 푸터 업데이트

  // 작업자 호출 (await 하지 않음)
  this._processJob(this.currentJobPostId);
 }

 /**
 * [이름 변경] generate -> _processJob
 * 실제 비디오 생성 로직 (내부 작업자)
 */
 async _processJob(postId) {
  console.group(`[VideoGenerator] S_PROCESS_JOB: 동영상 처리 시작 (PostID: ${postId})`);
  console.time("Video_Generation_Time");
  // [수정] 푸터 상태 업데이트
  this._updateFooterStatus("동영상 생성 시작...");

  let bitmaps = [];
  let audioSource = null;
  try {
   // --- Step 1: BGM 로드 ---
   this._updateFooterStatus("BGM 로드 중...");
   console.log("[VideoGenerator] S_GENERATE: Step 1/11 - BGM 로드 시도...");
   const bgmBlob = await this.imageDB.getBGM();
   if (!bgmBlob) {
    console.warn("[VideoGenerator] W_GENERATE: BGM이 IndexedDB에 없습니다.");
    throw new Error("먼저 '설정'에서 BGM (MP3)을 등록하세요.");
   }
   console.log(`[VideoGenerator] S_GENERATE: Step 1/11 - BGM 로드 성공 (Size: ${bgmBlob.size})`);
   // --- Step 2: 이미지 로드 ---
   this._updateFooterStatus("이미지 로드 중...");
   console.log("[VideoGenerator] S_GENERATE: Step 2/11 - 이미지 로드 시도...");
   const images = await this.imageDB.getImagesForPost(postId);
   if (!images || images.length === 0) {
    console.warn("[VideoGenerator] W_GENERATE: 이미지가 IndexedDB에 없습니다.");
    throw new Error("동영상을 만들 이미지가 없습니다. 먼저 이미지를 업로드하세요.");
   }
   console.log(`[VideoGenerator] S_GENERATE: Step 2/11 - 이미지 로드 성공 (Count: ${images.length})`);
   // --- Step 3: AudioContext 초기화 ---
   this._updateFooterStatus("오디오 컨텍스트 초기화...");
   console.log("[VideoGenerator] S_GENERATE: Step 3/11 - AudioContext 초기화...");
   this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
   this.audioDestination = this.audioCtx.createMediaStreamDestination();
   console.log(`[VideoGenerator] S_GENERATE: Step 3/11 - AudioContext 준비 (State: ${this.audioCtx.state})`);
   // --- Step 4: BGM 디코딩 ---
   this._updateFooterStatus("BGM 디코딩 중...");
   console.log("[VideoGenerator] S_GENERATE: Step 4/11 - BGM 디코딩 (decodeAudioData)...");
   console.time("BGM_Decode");
   const audioBuffer = await this.audioCtx.decodeAudioData(await bgmBlob.arrayBuffer());
   console.timeEnd("BGM_Decode");
   console.log(`[VideoGenerator] S_GENERATE: Step 4/11 - BGM 디코딩 성공 (Duration: ${audioBuffer.duration.toFixed(2)}s)`);
   // --- Step 5: 이미지 비트맵 변환 ---
   this._updateFooterStatus(`이미지 ${images.length}개 변환 중...`);
   console.log("[VideoGenerator] S_GENERATE: Step 5/11 - 이미지 비트맵 변환 (createImageBitmap)...");
   console.time("Bitmaps_Create");
   bitmaps = await Promise.all(images.map(img => createImageBitmap(img.blob)));
   console.timeEnd("Bitmaps_Create");
   console.log(`[VideoGenerator] S_GENERATE: Step 5/11 - 비트맵 변환 성공 (Count: ${bitmaps.length})`);
   // --- Step 6: 미디어 스트림 설정 ---
   this._updateFooterStatus("미디어 스트림 결합 중...");
   console.log("[VideoGenerator] S_GENERATE: Step 6/11 - 미디어 스트림 설정 (captureStream)...");
   const videoStream = this.canvas.captureStream(30);
   const audioStream = this.audioDestination.stream;
   this.videoStream = new MediaStream([
    videoStream.getVideoTracks()[0],
    audioStream.getAudioTracks()[0]
   ]);
   console.log("[VideoGenerator] S_GENERATE: Step 6/11 - 비디오/오디오 트랙 결합 완료.");

   // --- Step 7: MediaRecorder 설정 ---
   console.log("[VideoGenerator] S_GENERATE: Step 7/11 - MediaRecorder 설정...");
   this.recordedChunks = [];
   const mimeType = 'video/webm; codecs=vp9,opus';
   let chosenMimeType = '';
   if (MediaRecorder.isTypeSupported(mimeType)) {
    chosenMimeType = mimeType;
    this.mediaRecorder = new MediaRecorder(this.videoStream, { mimeType });
    console.log(`[VideoGenerator] S_GENERATE: Step 7/11 - 코덱 지원 확인 (Using: ${mimeType})`);
   } else {
    chosenMimeType = 'default';
    this.mediaRecorder = new MediaRecorder(this.videoStream);
    console.warn(`[VideoGenerator] W_GENERATE: 코덱 미지원 (VP9/Opus). 브라우저 기본값 사용 (MimeType: ${this.mediaRecorder.mimeType})`);
   }

   // --- Step 8: MediaRecorder 리스너 연결 ---
   console.log("[VideoGenerator] S_GENERATE: Step 8/11 - MediaRecorder 리스너 연결...");
   
   // ✨ [수정] Promise 기반이 아닌 콜백 기반으로 변경
   
   this.mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
     console.log(`[VideoGenerator] S_INTERNAL: ondataavailable (Chunk Size: ${e.data.size})`);
     this.recordedChunks.push(e.data);
    }
   };
  
   // [수정] onstop 핸들러
   this.mediaRecorder.onstop = async () => {
    try {
     console.log("[VideoGenerator] S_INTERNAL: onstop 이벤트 발생.");
     this._updateFooterStatus("동영상 인코딩 완료...");
    
     const videoBlob = new Blob(this.recordedChunks, { type: chosenMimeType === 'default' ? 'video/webm' : chosenMimeType });
     console.log(`[VideoGenerator] S_GENERATE: 최종 Blob 생성됨 (Size: ${videoBlob.size} bytes)`);

     // [신규] IndexedDB에 비디오 저장
     this._updateFooterStatus("동영상 DB 저장 중...");
     await this.imageDB.saveVideo(postId, videoBlob);
     console.log("[VideoGenerator] S_INTERNAL: 비디오가 IndexedDB에 저장됨.");

     console.timeEnd("Video_Generation_Time");
     console.groupEnd();

     // ✨ [수정] App 컨트롤러에 완료 콜백 전달
     this.app.handleVideoGenerationComplete(postId, videoBlob);
     this.cleanup(); // cleanup은 디스패처를 호출
     bitmaps.forEach(bmp => bmp.close());
    
    } catch (dbError) {
     console.error("[VideoGenerator] E_INTERNAL: onstop/DB저장 중 오류.", dbError);
     // ✨ [수정] App 컨트롤러에 실패 콜백 전달
     this.app.handleVideoGenerationFailed(postId, dbError);
     this.cleanup(); // cleanup은 디스패처를 호출
     bitmaps.forEach(bmp => bmp.close());
    }
   };
   
   this.mediaRecorder.onerror = (e) => {
     console.error("[VideoGenerator] E_INTERNAL: onerror 이벤트 발생.", e.error || e);
     const error = new Error(`MediaRecorder 오류: ${e.error || 'Unknown error'}`);
     
     // ✨ [수정] App 컨트롤러에 실패 콜백 전달
     this.app.handleVideoGenerationFailed(postId, error);
     this.cleanup(); // cleanup은 디스패처를 호출
     bitmaps.forEach(bmp => bmp.close());
     console.timeEnd("Video_Generation_Time");
     console.groupEnd();
   };

   // --- Step 9: 녹화 시작 ---
   console.log("[VideoGenerator] S_GENERATE: Step 9/11 - MediaRecorder 녹화 시작 (start)...");
   this.mediaRecorder.start();
  
   // --- Step 10: BGM 재생 ---
   console.log("[VideoGenerator] S_GENERATE: Step 10/11 - BGM 재생 시작 (audioSource.start)...");
   audioSource = this.audioCtx.createBufferSource();
   audioSource.buffer = audioBuffer;
   audioSource.connect(this.audioDestination);
   audioSource.start();

   // --- Step 11: 애니메이션 루프 ---
   console.log("[VideoGenerator] S_GENERATE: Step 11/11 - 애니메이션 루프 시작 (runAnimationLoop)...");
   this.runAnimationLoop(bitmaps, audioSource)
    .then(() => {
     console.log("[VideoGenerator] S_INTERNAL: 애니메이션 루프 정상 종료.");
     if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
       console.log("[VideoGenerator] S_INTERNAL: 녹화 중지 (mediaRecorder.stop) 호출.");
       this.mediaRecorder.stop();
     }
    })
    .catch(e => {
     console.error("[VideoGenerator] E_INTERNAL: 애니메이션 루프 중 오류 발생.", e);
     // ✨ [수정] App 컨트롤러에 실패 콜백 전달
     this.app.handleVideoGenerationFailed(postId, e);
     this.cleanup();
    });

  } catch (error) {
   console.error(`[VideoGenerator] E_PROCESS_JOB: 동영상 생성 실패 (${error.message})`, error);
   
   // ✨ [수정] App 컨트롤러에 실패 콜백 전달
   this.app.handleVideoGenerationFailed(postId, error);
   
   this.cleanup(); // ✨ 실패 시에도 cleanup을 호출하여 isBusy=false가 되도록 보장
   bitmaps.forEach(bmp => bmp.close());
   console.timeEnd("Video_Generation_Time");
   console.groupEnd();
   // throw error; // ✨ [수정] 더 이상 에러를 throw하지 않음
  }
 }

 /**
 * [신규] 큐 상태를 포함하여 푸터 UI를 업데이트하는 헬퍼
 */
 _updateFooterStatus(jobStatus) {
  // jobStatus: "BGM 로드 중..." 등
  
  if (!this.isBusy && this.videoJobQueue.length === 0) {
   this.ui.updateLocalVideoJobStatus(null); // 모든 작업 완료 시 푸터 숨김
   return;
  }
  
  let statusText = "";
  
  if (this.isBusy && jobStatus) {
   // 예: "BGM 로드 중..."
   statusText = jobStatus;
  } else if (this.isBusy && !jobStatus) {
   // 예: "동영상 처리 중..."
   statusText = "동영상 처리 중...";
  }
  
  // 큐 상태 추가
  if (this.videoJobQueue.length > 0) {
   statusText += ` (대기: ${this.videoJobQueue.length}개)`;
  }
  
  // UI 매니저의 실제 함수 호출
  this.ui.updateLocalVideoJobStatus(statusText.trim());
 }

 cleanup() {
  console.groupCollapsed(`[VideoGenerator] S_CLEANUP: 리소스 정리 시작 (PostID: ${this.currentJobPostId})`);
  
  this.isBusy = false;
  this.currentJobPostId = null; // ✨ [신규] 현재 작업 ID 리셋
 
  if (this.animationFrameId) {
   cancelAnimationFrame(this.animationFrameId);
   this.animationFrameId = null;
   console.log("[VideoGenerator] S_CLEANUP: AnimationFrame 중지됨.");
  }
 
  if (this.audioCtx && this.audioCtx.state !== 'closed') {
   this.audioCtx.close().catch(e => console.warn("[VideoGenerator] W_CLEANUP: AudioContext 닫기 오류.", e));
   console.log("[VideoGenerator] S_CLEANUP: AudioContext 닫힘.");
  }
  this.audioCtx = null;
 
  if (this.videoStream) {
   this.videoStream.getTracks().forEach(track => track.stop());
   this.videoStream = null;
   console.log("[VideoGenerator] S_CLEANUP: MediaStream 트랙 중지됨.");
  }
 
  if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
   this.mediaRecorder.stop();
   console.log("[VideoGenerator] S_CLEANUP: MediaRecorder 강제 중지됨.");
  }
  this.mediaRecorder = null;
  this.recordedChunks = [];
 
  console.log("[VideoGenerator] S_CLEANUP: 리소스 정리 완료.");
  console.groupEnd();
  
  this._dispatch(); // ✨ [신규] 다음 작업 디스패치 시도
 }

 async runAnimationLoop(bitmaps, audioSource) {
  console.log("[VideoGenerator] S_ANIM_LOOP: 애니메이션 루프 시작...");
  const IMAGE_DURATION_MS = 4000;
  const FADE_TIME_MS = 500;
  try {
   for (let i = 0; i < bitmaps.length; i++) {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
      console.warn(`[VideoGenerator] W_ANIM_LOOP: MediaRecorder 상태( ${this.mediaRecorder?.state} ). 애니메이션 루프 중단.`);
      break;
    }
    console.log(`[VideoGenerator] S_ANIM_LOOP: 프레임 ${i + 1}/${bitmaps.length} 렌더링 시작...`);
    // [수정] 푸터 상태 업데이트
    this._updateFooterStatus(`이미지 ${i + 1}/${bitmaps.length} 렌더링...`);
    await this.animateFrame(bitmaps[i], IMAGE_DURATION_MS, FADE_TIME_MS);
   }
  
   console.log("[VideoGenerator] S_ANIM_LOOP: 모든 프레임 렌더링 완료.");
   if (audioSource) {
    try {
     audioSource.stop();
     console.log("[VideoGenerator] S_ANIM_LOOP: BGM 오디오 소스 중지됨.");
    } catch(e) { /* 이미 중지됨 */ }
   }
  } catch (e) {
   console.error("[VideoGenerator] E_ANIM_LOOP: 애니메이션 루프 중 예외 발생.", e);
   throw e; // _processJob의 catch 블록으로 전파
  }
 }

 animateFrame(bitmap, duration, fadeTime) {
  return new Promise((resolve, reject) => {
   const startTime = performance.now();
   const endTime = startTime + duration;
   const fadeOutStartTime = endTime - fadeTime;
  
   const draw = (now) => {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
      console.warn("[VideoGenerator] W_ANIM_FRAME: draw() 중 레코더 중지 감지. 프레임 종료.");
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      reject(new Error("MediaRecorder가 렌더링 중 중지되었습니다."));
    
     return;
    }

    try {
     const elapsedTime = now - startTime;
     let alpha = 1.0;

     if (elapsedTime < fadeTime) {
      alpha = elapsedTime / fadeTime;
     } else if (now > fadeOutStartTime) {
      alpha = (endTime - now) / fadeTime;
     }
     alpha = Math.max(0, Math.min(1, alpha));

     // [수정] 배경색을 'white'로 변경
     this.ctx.fillStyle = 'white';
     this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
     // [수정] 'cover' (채우기)에서 'contain' (พอดี) 로직으로 변경
     const scale = Math.min(this.canvas.width / bitmap.width, this.canvas.height / bitmap.height);
     const dx = (this.canvas.width - bitmap.width * scale) / 2;
     const dy = (this.canvas.height - bitmap.height * scale) / 2;
     this.ctx.globalAlpha = alpha;
     this.ctx.drawImage(bitmap, dx, dy, bitmap.width * scale, bitmap.height * scale);
     this.ctx.globalAlpha = 1.0;
     if (now < endTime) {
      this.animationFrameId = requestAnimationFrame(draw);
     } else {
      this.animationFrameId = null;
      resolve();
     }
    } catch (e) {
     console.error("[VideoGenerator] E_ANIM_FRAME: draw() 함수 내부에서 예외 발생.", e);
     if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
     this.animationFrameId = null;
     reject(e);
    }
   };
   this.animationFrameId = requestAnimationFrame(draw);
  });
 }
}