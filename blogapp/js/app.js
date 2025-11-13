// 모든 모듈 임포트
import UIManager from './ui.js';
import FirebaseService from './firebase.js';
import JobManager from './jobs.js';
import ImageDB from './imageDB.js';
import ImageProcessor from './imageProcessor.js';
import VideoGenerator from './video.js';
// JSZip은 HTML에서 이미 로드됨 (window.JSZip)

/**
* ================================================================
* 클래스 0: App - 메인 컨트롤러
* (Axiom: SOLID - 모든 모듈을 조정)
* ================================================================
*/
export default class App {

 constructor() {
  // 1. 핵심 모듈 즉시 초기화
  this.ui = new UIManager();
this.imageDB = new ImageDB();
  this.imageProcessor = new ImageProcessor();

  // 2. 나중에 초기화될 모듈 (init)
  this.firebase = null;
this.jobManager = null;
  this.videoGenerator = null;

  // 3. 로컬 상태
  this.localState = {
   generatedPosts: [],
   templates: [],
   followUpTemplate: null,
   fileContent: null, // 파일 입력 내용
   defaultImages: [], // ✨ [신규] 기본 이미지 목록
   // ✨ [수정] 'image' 필터 추가
   filters: {
    status: [], // 'complete', 'incomplete', 'failed'
    video: [],  // 'yes', 'no'
    image: [],  // 'yes', 'no'
    sort: 'newest'
   }
  };
console.log("App Controller가 생성됨. UI 모듈 로드됨.");
 }

 /**
 * Main.js가 Firebase 설정을 로드한 후 호출
 */
 async init(firebaseConfig, firebaseServices) {
  try {
   this.ui.showToast("초기화 시작...", "info");
// 1. IndexedDB (이미지/BGM/비디오) 초기화
   await this.imageDB.init();

   // 2. Firebase 초기화 (인증 콜백 포함)
   this.firebase = new FirebaseService(firebaseConfig, firebaseServices, (user) => {
    this.handleAuthChange(user);
   });
// 3. Job Manager 초기화 (App 인스턴스 주입)
   this.jobManager = new JobManager(this);
// 4. Video Generator 초기화 (UI, DB 주입)
   this.videoGenerator = new VideoGenerator(this, this.ui, this.imageDB);
// 5. App과 UI 이벤트 바인딩
   this.ui.bindEvents(this);
   this.ui.renderFilters(this.localState.filters);
// ✨ 필터 UI 초기 렌더링
   
   // ✨ [신규] BGM 및 기본 이미지 상태 로드
   await this.updateBGMStatusUI();
   await this.updateDefaultImagesUI();

   console.log("App.init() 완료. Firebase 및 JobManager 준비됨.");
} catch (error) {
   console.error("App 초기화 실패:", error);
   this.ui.showToast(`초기화 실패: ${error.message}`, "error");
// 설정이 잘못되었을 수 있으므로 설정 탭을 강제로 엽니다.
   this.ui.showMainView('settings');
}
 }

 /**
 * 인증 상태 변경 처리
 */
 handleAuthChange(user) {
  this.ui.updateLoginStatus(user);

  if (user) {
   this.ui.showMainView('results');
this.ui.showToast("로그인되었습니다.", "success");
   this.jobManager.start();
   this.startDataListeners(); // 데이터 리스닝 시작
  } else {
   this.ui.showMainView('settings');
   this.jobManager.stop();
if (this.firebase) {
    this.firebase.stopAllListeners(); // 모든 리스너 중지
   }
   // 로컬 상태 초기화
   this.localState = {
    generatedPosts: [], 
    templates: [], 
    followUpTemplate: null, 
    fileContent: null,
    defaultImages: [], // ✨ [신규]
    // ✨ 필터 상태도 리셋
    filters: { status: [], video: [], image: [], sort: 'newest' }
   };
this.renderLocalData(); // UI 비우기
   this.ui.renderFilters(this.localState.filters); // 필터 UI 리셋
  }
 }

 /**
 * Firestore 데이터 리스너 시작
 */
 startDataListeners() {
  // API 키 리스너
  this.firebase.listenToData('keysCol', (keys) => {
   this.ui.renderApiKeys(keys);
   this.jobManager.updateApiKeys(keys); // JobManager에 최신 키 전달
  });
// 템플릿 리스너
  this.firebase.listenToData('templatesCol', (templates) => {
   this.localState.templates = templates;
   this.ui.renderTemplates(templates);
  });
// 후속 템플릿 리스너
  this.firebase.listenToData('followUpTemplatesCol', (templates) => {
   this.localState.followUpTemplate = (templates.length > 0) ? templates[0] : null;
   this.ui.renderFollowUpTemplate(this.localState.followUpTemplate);
   this.renderLocalData(); // 템플릿 유무에 따라 결과 카드 다시 렌더링
  });
// 게시물 리스너
  this.firebase.listenToData('postsCol', async (posts) => { // async
   // [신규] Firestore 데이터를 IndexedDB 데이터로 보강 (Augmentation)
   const augmentedPosts = await Promise.all(posts.map(async (post) => {
    const imageCount = await this.imageDB.getImageCountForPost(post.id);
    const videoBlob = await this.imageDB.getVideo(post.id);
    return {
     ...post,
     _imageCount: imageCount, // ✨ 보강된 데이터
     _hasVideo: !!videoBlob    // ✨ 보강된 데이터
    };
   }));

   this.localState.generatedPosts = augmentedPosts;
   this.renderLocalData(); // 보강된 데이터로 렌더링
  
 
   // 모달이 열려있다면 내용 업데이트
   if (this.ui.isModalOpen()) {
    const postId = this.ui.getOpenModalPostId();
    if (postId) {
     this.ui.openModal(postId); // 데이터 갱신
    }
   }
  });
}

 /**
 * ✨ [신규] 로컬 데이터 필터링 및 렌더링 (핵심 로직)
 */
 renderLocalData() {
  const { generatedPosts, filters, followUpTemplate } = this.localState;
// 1. 필터링
  const filteredPosts = generatedPosts.filter(post => {
   // 필터 그룹 1: 상태
   if (filters.status.length > 0) {
    const isComplete = post.isFollowUpComplete === true && !post.followUpError;
    const isFailed = post.error === true || post.followUpError === true;
    const isIncomplete = !post.isFollowUpComplete && !post.error;

    // 하나라도 매치되면 통과 (OR 조건)
    const statusMatch = 
     (filters.status.includes('complete') && isComplete) ||
     (filters.status.includes('incomplete') && isIncomplete) ||
     (filters.status.includes('failed') && isFailed);
    if (!statusMatch) return false;
   }

   // 필터 그룹 2: 비디오
   if (filters.video.length > 0) {
    // 하나라도 매치되면 통과 (OR 조건)
    const videoMatch =
     (filters.video.includes('yes') && post._hasVideo) ||
     (filters.video.includes('no') && !post._hasVideo);
    if (!videoMatch) return false;
   }
   
   // ✨ [신규] 필터 그룹 3: 이미지
   if (filters.image.length > 0) {
    // 하나라도 매치되면 통과 (OR 조건)
    const imageMatch =
     (filters.image.includes('yes') && post._imageCount > 0) ||
     (filters.image.includes('no') && post._imageCount === 0);
    if (!imageMatch) return false;
   }

   return true;
// 모든 필터 통과
  });

  // 2. 정렬
  const sortedPosts = [...filteredPosts].sort((a, b) => {
   const timeA = a.createdAt?.toMillis() || 0;
   const timeB = b.createdAt?.toMillis() || 0;
   return (filters.sort === 'newest') ? timeB - timeA : timeA - timeB;
  });
// 3. UI 렌더링
  const hasFollowUp = !!followUpTemplate;
  this.ui.renderResults(sortedPosts, hasFollowUp);
  this.ui.renderFilterTags(filters);
}
 
 /**
 * [신규] 다중 선택 필터 업데이트 핸들러
 */
 updateFilter(key, value) {
  const currentValues = this.localState.filters[key];
if (currentValues.includes(value)) {
   // 이미 있으면 제거
   this.localState.filters[key] = currentValues.filter(v => v !== value);
} else {
   // 없으면 추가
   this.localState.filters[key].push(value);
}
  // UI 상태 즉시 업데이트 및 재조회
  this.ui.renderFilters(this.localState.filters);
  this.renderLocalData();
}
 
 /**
 * [신규] 태그 제거 핸들러 (단일 값으로 리셋)
 */
 clearFilter(key, value = null) {
  if (value) {
   // 특정 값만 제거 (다중 선택 필터에서)
   this.localState.filters[key] = this.localState.filters[key].filter(v => v !== value);
} else {
   // 키 전체를 리셋 (정렬 필터 등)
   this.localState.filters[key] = Array.isArray(this.localState.filters[key]) ?
[] : 'all';
  }
  // UI 상태 즉시 업데이트 및 재조회
  this.ui.renderFilters(this.localState.filters);
  this.renderLocalData();
}

 /**
 * [신규] 정렬 업데이트 핸들러
 */
 updateSort(value) {
  this.localState.filters.sort = value;
  this.renderLocalData();
}


 // --- UI 핸들러 ---

 /**
 * Firebase 설정 저장 (main.js에서 호출됨)
 * @deprecated main.js에서 직접 처리하도록 변경됨
 */
 handleSaveConfig(configString) {
  // 이 로직은 main.js로 이동되었습니다.
// 단, main.js가 app.init() 전에 이 함수를 호출하려 할 수 있으므로
  // main.js의 하드코딩된 로직을 사용하는 것이 맞습니다.
console.warn("handleSaveConfig는 main.js에서 처리됩니다.");
 }

 /**
 * 참고 자료 파일 선택
 */
 handleFileSelect(event) {
  const file = event.target.files[0];
if (!file) {
   this.localState.fileContent = null;
   this.ui.updateStatusMessage("");
   return;
  }
  const reader = new FileReader();
reader.onload = (e) => {
   this.localState.fileContent = e.target.result;
   this.ui.updateStatusMessage(`'${file.name}' 로드됨. (용량: ${this.localState.fileContent.length}자)`);
  };
  reader.readAsText(file, "UTF-8");
}

 /**
 * 생성하기 버튼 클릭
 */
 handleGenerateClick(templateId, topicsString) {
  const template = this.localState.templates.find(t => t.id === templateId);
if (!template) {
   this.ui.showToast("유효한 템플릿을 선택하세요.", "error");
   return;
}
  if (!topicsString) {
   this.ui.showToast("주제를 하나 이상 입력하세요.", "error");
   return;
  }

  this.ui.setButtonLoading(true, "작업 생성 중...");
const topics = topicsString.split('\n').filter(t => t.trim().length > 0);
  const jobs = [];
for (const topic of topics) {
   let prompt = template.content.replace(/{주제}/g, topic);
if (this.localState.fileContent) {
    prompt = prompt.replace(/{자료}/g, this.localState.fileContent);
}

   jobs.push({
    jobId: this.jobManager.getNextJobId(),
    type: 'initial', // 'initial' 또는 'follow-up'
    topic: topic,
    prompt: prompt,
   });
}

  this.jobManager.addJobs(jobs);
  this.ui.showToast(`${jobs.length}개의 작업을 큐에 추가했습니다.`, "info");
  this.ui.clearTopicsInput();
  this.ui.setButtonLoading(false);
  this.ui.showMainView('results');
// 결과 탭으로 자동 이동
 }

 /**
 * 후속 작업 버튼 클릭
 */
 handleFollowUpClick(postId) {
  const post = this.localState.generatedPosts.find(p => p.id === postId);
const template = this.localState.followUpTemplate;
  if (!post || !template) {
   this.ui.showToast("게시물이나 후속 템플릿을 찾을 수 없습니다.", "error");
   return;
}

  this.ui.showToast(`'${post.topic}' 후속 작업 시작...`, "info");
  const prompt = template.content.replace(/{글}/g, post.content);
const job = {
   jobId: this.jobManager.getNextJobId(),
   type: 'follow-up',
   topic: `[후속] ${post.topic.substring(0, 20)}...`,
   prompt: prompt,
   originalPostId: postId,
  };
this.jobManager.addJobs([job]); // 큐에 추가
 }

 /**
 * 작업 재시도
 */
 async retryJob(postId) {
  const post = this.localState.generatedPosts.find(p => p.id === postId);
if (!post || !post.originalJob) {
   this.ui.showToast("재시도할 원본 작업을 찾을 수 없습니다.", "error");
   return;
}
  // 기존 실패 기록을 삭제하고 새 작업으로 등록
  await this.firebase.deleteGeneratedPost(postId);
const retryJob = {
   ...post.originalJob,
   jobId: this.jobManager.getNextJobId(),
   topic: post.topic,
  };
  
  this.jobManager.addRetryJob(retryJob, false);
this.ui.showToast(`'${post.topic}' 작업을 재시도합니다.`, "info");
 }

 /**
 * 후속 작업 재시도
 */
 async retryFollowUpJob(postId) {
  const post = this.localState.generatedPosts.find(p => p.id === postId);
if (!post || !post.originalFollowUpJob) {
   this.ui.showToast("재시도할 원본 후속 작업을 찾을 수 없습니다.", "error");
   return;
}

  // 후속 작업 상태만 리셋
  await this.firebase.updatePostAfterRetry(postId);
const retryJob = {
   ...post.originalFollowUpJob,
   jobId: this.jobManager.getNextJobId(),
   topic: `[재시도] ${post.topic.substring(0, 20)}...`,
   originalPostId: postId,
  };
this.jobManager.addRetryJob(retryJob, true);
  this.ui.showToast(`'${post.topic}' 후속 작업을 재시도합니다.`, "info");
 }

 /**
 * 게시물 삭제
 */
 async deletePost(postId) {
  if (!confirm("이 게시물과 연결된 모든 이미지/비디오를 삭제하시겠습니까?")) return;
try {
   await this.firebase.deleteGeneratedPost(postId);
   await this.imageDB.deleteImagesForPost(postId);
   await this.imageDB.deleteVideo(postId);
   this.ui.showToast("게시물과 이미지/비디오 삭제 완료.", "success");
// UI는 리스너에 의해 자동으로 갱신됩니다. (startDataListeners)
  } catch (e) {
   this.ui.showToast(`삭제 실패: ${e.message}`, "error");
}
 }

 /**
 * 클립보드에 복사
 */
 copyToClipboard(postId, type) {
  const post = this.localState.generatedPosts.find(p => p.id === postId);
if (!post) return;
  
  let textToCopy = '';
  if (type === 'content') {
   textToCopy = post.content;
} else if (type === 'followUp' && post.followUpResult) {
   textToCopy = post.followUpResult;
} else {
   this.ui.showToast("복사할 내용이 없습니다.", "error");
   return;
}
  
  navigator.clipboard.writeText(textToCopy).then(() => {
   this.ui.showToast("클립보드에 복사되었습니다.", "success");
  }).catch(err => {
   this.ui.showToast(`복사 실패: ${err.message}`, "error");
  });
}

 // --- 이미지 및 BGM 핸들러 ---

 /**
 * [신규] 통합 파일 업로드 핸들러 (디스패처)
 * 여러 파일 (이미지 또는 ZIP)을 처리합니다.
*/
 async handleFileUploads(postId, fileList) {
  if (!fileList || fileList.length === 0) return;

  this.ui.showToast(`${fileList.length}개 파일 처리 시작...`, "info");
for (const file of fileList) {
   try {
    if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
     // 1. ZIP 파일 처리
     await this.handleZipImageUpload(postId, file);
} else if (file.type.startsWith('image/')) {
     // 2. 개별 이미지 파일 처리
     await this.handleImageUpload(postId, file);
} else {
     // 3. 미지원 파일
     this.ui.showToast(`지원하지 않는 파일 형식: ${file.name}`, "error");
}
   } catch (e) {
    // 개별 파일 처리 중 오류가 발생해도 다음 파일 처리를 계속합니다.
console.error(`'${file.name}' 처리 중 오류 발생:`, e);
    this.ui.showToast(`'${file.name}' 처리 실패: ${e.message}`, "error");
}
  }
  // [수정] 모든 파일 처리 후, UI를 *한 번만* 갱신
  // this.ui.updateIconStatus(postId);
// -> IconStatus는 renderLocalData에서 갱신됨
  
  // 데이터 보강 및 렌더링 강제
  const post = this.localState.generatedPosts.find(p => p.id === postId);
post._imageCount = await this.imageDB.getImageCountForPost(postId);
  this.renderLocalData(); // 필터링이 다시 적용되어야 할 수 있음

  if (this.ui.isModalOpen() && this.ui.getOpenModalPostId() === postId) {
   this.ui.renderModalGallery(postId);
}
 }

 /**
 * 개별 이미지 업로드 (단일 파일)
 * (이제 handleFileUploads에 의해 호출됨)
 */
 async handleImageUpload(postId, file) {
  if (!file) return;
this.ui.showToast(`'${file.name}' 처리 중...`, "info");
  try {
   const processedBlob = await this.imageProcessor.processImage(file);
   await this.imageDB.addImage(postId, file.type, processedBlob);
this.ui.showToast(`'${file.name}' 이미지 추가 완료.`, "success");
   
   // [수정] UI 갱신은 상위 디스패처로 이동
   
  } catch (e) {
   console.error("이미지 업로드 실패:", e);
this.ui.showToast(`이미지 처리 실패: ${e.message}`, "error");
   throw e; // 상위 디스패처로 오류 전파
  }
 }

 /**
 * ZIP 파일 이미지 업로드 (단일 파일)
 * (이제 handleFileUploads에 의해 호출됨)
 */
 async handleZipImageUpload(postId, file) {
  if (!file) return;
this.ui.showToast(`'${file.name}' ZIP 파일 여는 중...`, "info");
  
  try {
   const zip = await window.JSZip.loadAsync(file);
   let imageCount = 0;
for (const filename in zip.files) {
    if (filename.startsWith('__MACOSX') || zip.files[filename].dir) {
     continue;
// 메타데이터나 디렉터리 스킵
    }
    
    const imageFile = zip.files[filename];
const fileType = imageFile.name.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    try {
     const blob = await imageFile.async('blob');
const processedBlob = await this.imageProcessor.processImage(new File([blob], filename, { type: fileType }));
     await this.imageDB.addImage(postId, fileType, processedBlob);
     imageCount++;
} catch (e) {
     console.warn(`ZIP 내 '${filename}' 처리 실패:`, e);
     this.ui.showToast(`'${filename}' 처리 실패: ${e.message}`, "error");
}
   }
   
   this.ui.showToast(`ZIP에서 ${imageCount}개 이미지 추가 완료.`, "success");
// [수정] UI 갱신은 상위 디스패처로 이동

  } catch (e) {
   console.error("ZIP 처리 실패:", e);
this.ui.showToast(`ZIP 파일 처리 실패: ${e.message}`, "error");
   throw e; // 상위 디스패처로 오류 전파
  }
 }
 
 /**
 * 이미지 삭제 (모달에서)
 */
 async handleDeleteImage(imageId, postId) {
  try {
   await this.imageDB.deleteImage(imageId);
this.ui.showToast("이미지 삭제 완료.", "success");
   // 갤러리 및 카운트 갱신 (데이터 보강을 위해 app.js의 renderLocalData 호출)
   const post = this.localState.generatedPosts.find(p => p.id === postId);
post._imageCount = await this.imageDB.getImageCountForPost(postId); // 카운트 갱신
   
   this.renderLocalData();
   this.ui.renderModalGallery(postId);
// 모달 즉시 갱신
   // this.ui.updateIconStatus(post); // renderLocalData가 처리
  } catch (e) {
   this.ui.showToast(`이미지 삭제 실패: ${e.message}`, "error");
}
 }

 /**
 * 비디오 삭제 (모달에서)
 */
 async handleDeleteVideo(postId) {
  try {
   await this.imageDB.deleteVideo(postId);
this.ui.showToast("동영상 삭제 완료.", "success");
   // 데이터 보강 및 UI 갱신
   const post = this.localState.generatedPosts.find(p => p.id === postId);
post._hasVideo = false; // 상태 갱신
   
   this.renderLocalData();
   this.ui.renderModalGallery(postId);
// 모달 즉시 갱신
   // this.ui.updateIconStatus(post); // renderLocalData가 처리
  } catch (e) {
   this.ui.showToast(`동영상 삭제 실패: ${e.message}`, "error");
}
 }

 /**
 * BGM 파일 저장
 */
 async handleSaveBGM() {
  const file = this.ui.elements.bgmFileInput.files[0];
if (!file) {
   this.ui.showToast("BGM 파일을 선택하세요.", "error");
   return;
  }
  try {
   await this.imageDB.saveBGM(file);
this.ui.showToast("BGM이 성공적으로 저장되었습니다.", "success");
   this.ui.elements.bgmFileInput.value = ''; // 입력 필드 초기화
   await this.updateBGMStatusUI(); // ✨ [신규] BGM 상태 UI 갱신
  } catch (e) {
   this.ui.showToast(`BGM 저장 실패: ${e.message}`, "error");
}
 }

 // --- ✨ [신규] BGM 및 기본 이미지 핸들러 ---

 /**
 * BGM 상태 UI 갱신
 */
 async updateBGMStatusUI() {
  try {
   const bgmFile = await this.imageDB.getBGM(); // file 객체 또는 null
   this.ui.renderBGMStatus(bgmFile);
  } catch (e) {
   console.error("BGM 상태 UI 갱신 실패:", e);
   this.ui.renderBGMStatus(null);
  }
 }
 
 /**
 * BGM 삭제
 */
 async handleDeleteBGM() {
  if (!confirm("저장된 BGM을 삭제하시겠습니까?")) return;
  try {
   await this.imageDB.deleteBGM();
   this.ui.showToast("BGM이 삭제되었습니다.", "success");
   await this.updateBGMStatusUI();
  } catch (e) {
   this.ui.showToast(`BGM 삭제 실패: ${e.message}`, "error");
  }
 }

 /**
 * 기본 이미지 UI 갱신
 */
 async updateDefaultImagesUI() {
  try {
   const images = await this.imageDB.getDefaultImages();
   this.localState.defaultImages = images;
   this.ui.renderDefaultImages(images);
  } catch (e) {
   console.error("기본 이미지 UI 갱신 실패:", e);
   this.ui.renderDefaultImages([]);
  }
 }

 /**
 * 기본 이미지 업로드
 */
 async handleDefaultImageUpload(fileList) {
  if (!fileList || fileList.length === 0) return;
  this.ui.showToast(`${fileList.length}개 기본 이미지 저장 중...`, "info");
  try {
   for (const file of fileList) {
    if (file.type.startsWith('image/')) {
     await this.imageDB.addDefaultImage(file);
    }
   }
   this.ui.showToast("기본 이미지 저장이 완료되었습니다.", "success");
  } catch (e) {
   this.ui.showToast(`기본 이미지 저장 실패: ${e.message}`, "error");
  } finally {
   this.ui.elements.defaultImageInput.value = ''; // 입력 필드 초기화
   await this.updateDefaultImagesUI(); // UI 갱신
  }
 }

 /**
 * 기본 이미지 삭제
 */
 async handleDeleteDefaultImage(id) {
  try {
   await this.imageDB.deleteDefaultImage(id);
   this.ui.showToast("기본 이미지가 삭제되었습니다.", "success");
   await this.updateDefaultImagesUI();
  } catch (e) {
   this.ui.showToast(`기본 이미지 삭제 실패: ${e.message}`, "error");
  }
 }
 
 /**
 * [신규] JobManager가 작업 성공 시 호출하는 콜백
 * (기본 이미지 추가 로직 담당)
 */
 async handleJobSuccess(job, newPostId, responseText) {
  try {
   if (job.type === 'initial') {
    // newPostId는 방금 생성된 Firestore 문서 ID
    const defaultImages = this.localState.defaultImages;
    
    if (defaultImages.length > 0) {
     this.ui.showToast(`'${job.topic}'... 기본 이미지 ${defaultImages.length}개 추가 중...`, "info");
     
     for (const imgData of defaultImages) {
      try {
       // File 객체로 변환 (ImageProcessor가 File 객체를 받음)
       const file = new File([imgData.blob], imgData.name, {type: imgData.type});
       // ✨ 각 게시물마다 고유한 노이즈 처리를 위해 processImage를 다시 호출
       const processedBlob = await this.imageProcessor.processImage(file);
       // 개별 포스트 ID로 이미지 저장
       await this.imageDB.addImage(newPostId, processedBlob.type, processedBlob);
      } catch (e) {
       console.error(`기본 이미지 '${imgData.name}' 처리 실패:`, e);
       this.ui.showToast(`'${imgData.name}' 처리 실패: ${e.message}`, "error");
      }
     }
    }
    
   } else if (job.type === 'follow-up') {
    // newPostId는 null임. job.originalPostId를 사용
    await this.firebase.updatePostWithFollowUp(job, responseText, false);
   }
  } catch (e) {
   console.error("handleJobSuccess 중 오류 발생:", e);
   this.ui.showToast(`작업 성공 처리 중 오류: ${e.message}`, "error");
  }
 }

 // --- 비디오 핸들러 ---

 /**
 * 동영상 생성 버튼 클릭
 */
 /**
 * 동영상 생성 버튼 클릭 (이제 큐에 작업을 추가)
 */
 async handleGenerateVideo(postId) {
  // VideoGenerator에 작업을 등록하고 즉시 반환 (Fire and Forget)
  this.videoGenerator.queueJob(postId);
}

 /**
 * [신규] VideoGenerator가 작업 완료 후 호출하는 콜백
 */
 handleVideoGenerationComplete(postId, videoBlob) {
  this.ui.showToast(`'${postId.substring(0, 6)}...' 동영상 생성 완료.`, "success");
// 데이터 보강 및 UI 갱신
  const post = this.localState.generatedPosts.find(p => p.id === postId);
if (post) {
    post._hasVideo = true; // 상태 갱신
  }
  
  this.renderLocalData();
// renderLocalData가 아이콘 상태 갱신

  // 모달이 열려있다면 갱신
  if (this.ui.isModalOpen() && this.ui.getOpenModalPostId() === postId) {
   this.ui.renderModalGallery(postId);
}

  // 미리보기 모달 열기 (큐의 마지막 작업이 완료될 때마다 열림)
  const videoUrl = URL.createObjectURL(videoBlob);
  this.ui.openVideoModal(videoUrl);
}

 /**
 * [신규] VideoGenerator가 작업 실패 후 호출하는 콜백
 */
 handleVideoGenerationFailed(postId, error) {
  console.error(`동영상 생성 실패 (PostID: ${postId}):`, error);
this.ui.showToast(`'${postId.substring(0, 6)}...' 동영상 생성 실패: ${error.message}`, "error");
  // UI 갱신은 없음 (VideoGenerator가 푸터 상태를 정리)
 }
}
