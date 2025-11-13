/**
* ================================================================
* 클래스 1: UIManager - (필터 / 태그 / 결과 / 모달 렌더링)
* ================================================================
*/
export default class UIManager {
 constructor() {
  this.elements = this.queryElements();
// ✨ [삭제] 필터 상태를 app.js로 이전
  // this.currentFilter = 'all';
  // this.currentSort = 'newest';
  this.openModalPostId = null;
this.localVideoJob = null; // 로컬 비디오 작업 상태
 }

 // 1. 모든 DOM 요소를 한 번에 찾아 객체로 관리
 queryElements() {
  const els = {};
const ids = [
   'workspace-view', 'settings-view',
   'nav-input', 'nav-results', 'nav-settings',
   'status-message', 'generate-button', 'generate-button-text', 'generate-spinner',
   'user-id-display', 'modal-overlay', 'modal-container', 'modal-title',
   'modal-content', 'modal-followup-wrapper', 'modal-followup-content',
   'modal-close-btn', 'modal-close-footer-btn',
   'workspace-input-panel', 'workspace-results-panel', 
   'job-footer-bar', 'processing-list', 'queue-status-display', 'toast',
   'modal-image-gallery-wrapper', 'modal-image-gallery',
   'firebase-config-input', 'save-firebase-config-button',
   'google-login-button', 'anonymous-login-button', 'logout-button',
   'api-key-input', 'add-key-button', 'api-keys-list',
   'template-select', 'file-input', 'topics-input',
   'template-name', 'template-content', 'template-id-hidden', 'save-template-button', 'templates-list',
   'followup-template-name-single', 'followup-template-content-single', 'save-followup-template-single-button',
   // ✨ [수정] 필터 ID 변경
   'sort-creation-date', 'results-container',
   'filter-group-status', 'filter-group-video', 'filter-tag-container',
   'bgm-file-input', 
'save-bgm-button',
   'bgm-status-container', // ✨ [신규]
   'default-image-input', // ✨ [신규]
   'default-image-gallery', // ✨ [신규]
   'video-modal-overlay', 'video-modal-container', 'video-modal-close-btn', 'video-preview-player',
   'modal-video-wrapper', 'modal-video-player', 'modal-video-delete-btn'
  ];
ids.forEach(id => {
   const el = document.getElementById(id);
   if (el) {
    els[id.replace(/-(\w)/g, (match, p1) => p1.toUpperCase())] = el;
   }
  });
return els;
 }

 // 2. 이벤트 리스너 바인딩
 bindEvents(app) {
  // this.elements.saveFirebaseConfigButton.onclick = ... (main.js에서 처리)
  this.elements.googleLoginButton.onclick = () => app.firebase.handleGoogleLogin();
this.elements.anonymousLoginButton.onclick = () => app.firebase.handleAnonymousLogin();
  this.elements.logoutButton.onclick = () => app.firebase.handleLogout();
 
  this.elements.navInput.onclick = () => this.showMainView('input');
  this.elements.navResults.onclick = () => this.showMainView('results');
this.elements.navSettings.onclick = () => this.showMainView('settings');
  this.elements.addKeyButton.onclick = () => {
   const key = this.elements.apiKeyInput.value;
app.firebase.addApiKey(key).then(() => {
    this.elements.apiKeyInput.value = '';
   });
  };
this.elements.saveTemplateButton.onclick = () => {
   const id = this.elements.templateIdHidden.value;
   const name = this.elements.templateName.value;
   const content = this.elements.templateContent.value;
app.firebase.saveTemplate(id, name, content).then(() => {
    this.elements.templateIdHidden.value = '';
    this.elements.templateName.value = '';
    this.elements.templateContent.value = '';
    this.showToast("템플릿이 저장되었습니다.", "success"); // ✨ 성공 토스트
   }).catch(e => {
    console.error("템플릿 저장 실패:", e);
    this.showToast(`템플릿 저장 실패: ${e.message}`, "error"); // ✨ 오류 토스트
   });
};

  this.elements.saveFollowupTemplateSingleButton.onclick = () => {
   const name = this.elements.followupTemplateNameSingle.value;
   const content = this.elements.followupTemplateContentSingle.value;

   // ✨ 비동기 호출 및 .then().catch() 예외 처리 구문 추가
   app.firebase.saveSingleFollowUpTemplate(name, content)
    .then((action) => {
     // firebase.js에서 반환된 'action' 값을 기반으로 메시지 분기
     let message = "후속 템플릿이 저장되었습니다.";
     if (action === 'deleted') { // 
      message = "후속 템플릿이 (내용이 비어) 삭제되었습니다.";
     }
     this.showToast(message, "success");
    })
    .catch(e => {
     // [중요] 저장 실패 시 사용자에게 오류를 알림
     console.error("후속 템플릿 저장 실패:", e);
     // 예: "저장 실패: 템플릿에 {글} 변수가 포함되어야 합니다." 
     this.showToast(`저장 실패: ${e.message}`, "error");
    });
  };
  
this.elements.saveBgmButton.onclick = () => app.handleSaveBGM();

  this.elements.fileInput.onchange = (e) => app.handleFileSelect(e);
this.elements.generateButton.onclick = () => {
   const templateId = this.elements.templateSelect.value;
   const topics = this.elements.topicsInput.value;
   app.handleGenerateClick(templateId, topics);
  };
this.elements.topicsInput.oninput = () => {
   if (this.elements.topicsInput.value === '') {
    this.setButtonLoading(false);
   }
  };
// ✨ [수정] 정렬 핸들러가 app.updateSort 호출
  this.elements.sortCreationDate.onchange = (e) => {
   app.updateSort(e.target.value);
  };
// ✨ [삭제] 기존 필터 핸들러 삭제

  // 모달
  this.elements.modalOverlay.onclick = () => this.closeModal();
this.elements.modalCloseBtn.onclick = () => this.closeModal();
  this.elements.modalCloseFooterBtn.onclick = () => this.closeModal();
  
  // ✨ [신규] 기본 이미지 업로드 이벤트
  this.elements.defaultImageInput.onchange = (e) => app.handleDefaultImageUpload(e.target.files);
}

 // 3. UI 상태 변경 메서드
 showView(viewName) {
  this.elements.workspaceView.classList.toggle('hidden', viewName !== 'workspace');
  this.elements.settingsView.classList.toggle('hidden', viewName === 'workspace');
['navWorkspace', 'navSettings'].forEach(navId => {
   const el = this.elements[navId];
   const isActive = (navId === 'navWorkspace' && viewName === 'workspace') || (navId === 'navSettings' && viewName !== 'workspace');
   el.classList.toggle('border-blue-600', isActive);
   el.classList.toggle('text-blue-600', isActive);
   el.classList.toggle('border-transparent', !isActive);
   el.classList.toggle('text-gray-500', !isActive);
  });
}

 // 3. UI 상태 변경 메서드

// ✨ [신규] 통합 탭 뷰어
showMainView(viewName) {
 // 1. 패널(View) 표시/숨기기
 const isSettings = viewName === 'settings';
this.elements.workspaceView.classList.toggle('hidden', isSettings);
 this.elements.settingsView.classList.toggle('hidden', !isSettings);

 if (!isSettings) {
  // 'input' 또는 'results' 뷰 처리
  this.elements.workspaceInputPanel.classList.toggle('hidden', viewName !== 'input');
this.elements.workspaceResultsPanel.classList.toggle('hidden', viewName !== 'results');
 }

 // 2. 탭 버튼 스타일 업데이트
 const navs = ['navInput', 'navResults', 'navSettings'];
const viewMap = { 'input': 'navInput', 'results': 'navResults', 'settings': 'navSettings' };
 const activeNavId = viewMap[viewName];
navs.forEach(navId => {
  const el = this.elements[navId];
  if (!el) return;
  const isActive = (navId === activeNavId);
  el.classList.toggle('border-blue-600', isActive);
  el.classList.toggle('text-blue-600', isActive);
  el.classList.toggle('border-transparent', !isActive);
  el.classList.toggle('text-gray-500', !isActive);
 });
}

// ✨ [삭제] showView(viewName) { ... }
// ✨ [삭제] showWorkspaceView(viewName) { ... }

updateLoginStatus(user) {
 const navsToToggle = [this.elements.navInput, this.elements.navResults];
if (user) {
  this.elements.userIdDisplay.textContent = user.isAnonymous ? `익명 로그인됨 (ID: ${user.uid.substring(0, 6)}...)` : `로그인됨: ${user.email}`;
  this.elements.googleLoginButton.classList.add('hidden');
  this.elements.anonymousLoginButton.classList.add('hidden');
  this.elements.logoutButton.classList.remove('hidden');
// ✨ [수정] 입력/결과 탭 활성화
  navsToToggle.forEach(nav => {
  if (!nav) return;
  nav.disabled = false;
  nav.classList.remove('opacity-50', 'cursor-not-allowed');
  });
} else {
  this.elements.userIdDisplay.textContent = "로그아웃 상태입니다. '설정' 탭에서 로그인하세요.";
  this.elements.googleLoginButton.classList.remove('hidden');
  this.elements.anonymousLoginButton.classList.remove('hidden');
  this.elements.logoutButton.classList.add('hidden');
// ✨ [수정] 입력/결과 탭 비활성화
  navsToToggle.forEach(nav => {
  if (!nav) return;
  nav.disabled = true;
  nav.classList.add('opacity-50', 'cursor-not-allowed');
  });
this.showMainView('settings'); // ✨ [수정]
 }
}

 showToast(message, type = 'success') {
  const toast = this.elements.toast;
  if (!toast) return;
toast.textContent = message;
  toast.className = type;
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

 setButtonLoading(isLoading, text = "생성하기") {
  this.elements.generateButtonText.textContent = text;
  this.elements.generateSpinner.classList.toggle('hidden', !isLoading);
 }

 updateStatusMessage(message) {
  this.elements.statusMessage.textContent = message;
}

 setFirebaseConfigInput(config) {
  if (!config) return;
  try {
   this.elements.firebaseConfigInput.value = JSON.stringify(JSON.parse(config), null, 2);
} catch(e) {
   this.elements.firebaseConfigInput.value = config;
  }
 }

 clearTopicsInput() {
  this.elements.topicsInput.value = '';
}

 // 4. 렌더링 메서드
 renderApiKeys(apiKeys = []) {
  const list = this.elements.apiKeysList;
  list.innerHTML = '';
if (apiKeys.length === 0) { list.innerHTML = '<p class="text-gray-500">추가된 API 키가 없습니다.</p>'; return;
}
 
  const sortedKeys = [...apiKeys].sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
sortedKeys.forEach(key => {
   let s = { color: 'text-gray-500', text: key.status || '알 수 없음' };
   if (key.status === 'ready') { s = { color: 'text-green-500', text: '준비' }; }
   if (key.status === 'busy') { s = { color: 'text-yellow-600', text: '사용중' }; }
   if (key.status === 'cooldown') { s = { color: 'text-blue-500', text: `휴식 (1분)` }; }
   if (key.status === 'dead') { s = { color: 'text-red-700', text: `비활성 (실패: ${key.failureCount || 0})` }; }
  
   const buttonsHtml = (key.status === 'dead')
    
? `<button class="icon-btn icon-btn-retry" title="키 재설정"><i class="bi bi-arrow-counterclockwise"></i></button>
     <button class="icon-btn icon-btn-danger" title="삭제"><i class="bi bi-trash"></i></button>`
    : `<button class="icon-btn icon-btn-danger" title="삭제"><i class="bi bi-trash"></i></button>`;
   
   const el = this.createDOMElement('div', 'flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-md', `
    <span class="font-mono text-sm"><span class="font-bold ${s.color}">[${s.text}]</span> ...${key.key.slice(-4)}</span>
    <div class="flex space-x-2">${buttonsHtml}</div>
   `);
el.querySelector('button.icon-btn-danger').onclick = () => window.app.firebase.deleteApiKey(key.id);
   if (key.status === 'dead') {
    el.querySelector('button.icon-btn-retry').onclick = () => window.app.firebase.resetApiKey(key.id);
}
   list.appendChild(el);
  });
 }

 renderTemplates(templates = []) {
  const list = this.elements.templatesList;
  const select = this.elements.templateSelect;
list.innerHTML = ''; select.innerHTML = '';
 
  if (templates.length === 0) {
   list.innerHTML = '<p class="text-gray-500">템플릿 없음</p>';
select.innerHTML = '<option>템플릿 없음</option>';
   return;
  }
 
  const sorted = [...templates].sort((a, b) => a.name.localeCompare(b.name));
sorted.forEach(t => {
   select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
   const el = this.createDOMElement('div', 'flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-md', `
    <span class="font-medium text-gray-700">${t.name}</span>
    <div class="space-x-2">
     <button class="icon-btn" title="수정"><i class="bi bi-pencil-square"></i></button>
     <button class="icon-btn icon-btn-danger" title="삭제"><i class="bi bi-trash"></i></button>
    </div>
   `);
   el.querySelector('button.icon-btn').onclick = () => this.loadTemplateForEdit(t);
   el.querySelector('button.icon-btn-danger').onclick = () => window.app.firebase.deleteTemplate(t.id);
   list.appendChild(el);
  });
}

 loadTemplateForEdit(template) {
  this.elements.templateIdHidden.value = template.id;
  this.elements.templateName.value = template.name;
  this.elements.templateContent.value = template.content;
  this.showToast("템플릿 불러옴.", "info");
}

 renderFollowUpTemplate(template) {
  if (template) {
   this.elements.followupTemplateNameSingle.value = template.name;
   this.elements.followupTemplateContentSingle.value = template.content;
} else {
   this.elements.followupTemplateNameSingle.value = '';
   this.elements.followupTemplateContentSingle.value = '';
}
 }

 // ✨ [수정] posts 배열은 이미 app.js에서 필터링 및 정렬 완료됨
 renderResults(posts = [], hasFollowUpTemplate) {
  const container = this.elements.resultsContainer;
container.innerHTML = '';
 
  container.className = 'h-[600px] overflow-y-auto pr-2 grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))] items-start';
// ✨ [삭제] UI.js에서 필터링/정렬 로직 모두 제거
  // let filteredPosts = ...
  // const sortedPosts = ...

  if (posts.length === 0) {
   container.innerHTML = `<p class="text-gray-500">${(window.app.localState.filters.status.length === 0 && window.app.localState.filters.video.length === 0) ?
'아직 생성된 글이 없습니다.' : '일치하는 항목이 없습니다.'}</p>`;
   return;
  }
 
  // ✨ [수정] 'sortedPosts' -> 'posts'로 변경
  posts.forEach(post => {
   const contentPreview = post.error
    ? `<p class="text-red-600 font-medium">${post.content}</p>`
    : `<p class="text-gray-700 whitespace-pre-wrap">${post.content.substring(0, 100)}...</p>`;
  
   const buttonsContainer = this.createDOMElement('div', 'flex items-center justify-end space-x-3 pt-2 border-t border-gray-100');
  
   buttonsContainer.innerHTML += `<span id="image-count-${post.id}" class="hidden text-sm text-gray-500 mr-auto"></span>`;
  
   // ✨ [수정] 통합 파일 입력
   const fileInputId = `file-input-${post.id}`;
   const fileInput = this.createDOMElement('input', 'hidden', '');
   fileInput.type = 'file';
 
  fileInput.accept = 'image/*,.zip'; // 이미지와 ZIP 모두 허용
   fileInput.id = fileInputId;
   fileInput.multiple = true; // 여러 파일 선택 허용
   fileInput.onchange = (e) => window.app.handleFileUploads(post.id, e.target.files); // 새 디스패처 호출
  
   // ✨ [삭제] zipInput 관련 코드 전체 삭제

   if (post.isFollowUpComplete) {
    buttonsContainer.innerHTML += this.createActionButton('bi-arrows-fullscreen', '', `window.app.ui.openModal('${post.id}')`, "전체 보기");
buttonsContainer.innerHTML += this.createActionButton('bi-clipboard', '', `window.app.copyToClipboard('${post.id}', 'content')`, "원본 복사");
    if (post.followUpError) {
     buttonsContainer.innerHTML += this.createActionButton('bi-arrow-clockwise', 'icon-btn-retry', `window.app.retryFollowUpJob('${post.id}')`, "재시도");
} else {
     buttonsContainer.innerHTML += this.createActionButton('bi-clipboard-check', 'icon-btn-purple', `window.app.copyToClipboard('${post.id}', 'followUp')`, "결과 복사");
}
   } else if (post.error) {
    buttonsContainer.innerHTML += this.createActionButton('bi-exclamation-triangle', '', `window.app.ui.openModal('${post.id}')`, "실패 사유 보기");
buttonsContainer.innerHTML += this.createActionButton('bi-arrow-clockwise', 'icon-btn-retry', `window.app.retryJob('${post.id}')`, "재시도");
   } else {
    buttonsContainer.innerHTML += this.createActionButton('bi-arrows-fullscreen', '', `window.app.ui.openModal('${post.id}')`, "전체 보기");
buttonsContainer.innerHTML += this.createActionButton('bi-clipboard', '', `window.app.copyToClipboard('${post.id}', 'content')`, "원본 복사");
    if (hasFollowUpTemplate) {
     buttonsContainer.innerHTML += this.createActionButton('bi-magic', 'icon-btn-purple', `window.app.handleFollowUpClick('${post.id}')`, "후속 작업 실행");
}
   }

   // ✨ [수정] 버튼 ID 할당 및 ZIP 버튼 삭제
   buttonsContainer.insertAdjacentHTML('beforeend', this.createActionButton('bi-image', '', `document.getElementById('${fileInputId}').click()`, "이미지/ZIP 추가", `btn-image-${post.id}`));
buttonsContainer.insertAdjacentHTML('beforeend', this.createActionButton('bi-film', 'icon-btn-purple', `window.app.handleGenerateVideo('${post.id}')`, "동영상 생성", `btn-video-${post.id}`));
   buttonsContainer.insertAdjacentHTML('beforeend', this.createActionButton('bi-trash', 'icon-btn-danger', `window.app.deletePost('${post.id}')`, "삭제"));
  
   buttonsContainer.appendChild(fileInput);
const contentWrapper = this.createDOMElement('div', 'relative z-20', `
    <h4 class="font-semibold text-gray-800">${post.topic}</h4>
    <div class="mt-2 mb-3 text-sm cursor-pointer" onclick="window.app.ui.openModal('${post.id}')">${contentPreview}</div>
   `);
contentWrapper.appendChild(buttonsContainer);

   const el = this.createDOMElement('div', 'relative bg-white p-3 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border border-gray-200', '');
   el.appendChild(contentWrapper);
const dropZone = this.createDOMElement('div', 'dropzone', '');
  
   const dragHandler = (e, isActive) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.toggle('dropzone-active', isActive);
};

   // ✨ [D&D 수정] 이벤트를 dropZone이 아닌 el에 바인딩
   el.ondragover = (e) => dragHandler(e, true);
   el.ondragleave = (e) => dragHandler(e, false);
el.ondrop = (e) => {
    dragHandler(e, false);
    const files = e.dataTransfer.files;
if (!files || files.length === 0) return;
    // ✨ [수정] 드롭 핸들러가 새 디스패처 호출
    window.app.handleFileUploads(post.id, files);
};
  
   el.appendChild(dropZone);
   container.appendChild(el);
  
   // ✨ [수정] 보강된 데이터(post)를 전달
   this.updateIconStatus(post);
  });
}

 // [수정] ID 파라미터 추가
 createActionButton(icon, extraClass, onclick, title, id = null) {
  const idAttr = id ?
`id="${id}"` : '';
  return `<button ${idAttr} class="icon-btn ${extraClass}" onclick="${onclick}" title="${title}"><i class="bi ${icon}"></i></button>`;
 }

 isModalOpen() {
  return !this.elements.modalOverlay.classList.contains('hidden');
}

 getOpenModalPostId() {
  return this.openModalPostId;
 }

 openModal(postId) {
  const post = window.app.localState.generatedPosts.find(p => p.id === postId);
if (!post) return;
 
  this.openModalPostId = postId;
  this.elements.modalTitle.textContent = post.topic;
  this.elements.modalContent.textContent = post.content;
if (post.isFollowUpComplete && post.followUpResult) {
   this.elements.modalFollowupContent.textContent = post.followUpResult;
   this.elements.modalFollowupWrapper.classList.remove('hidden');
   this.elements.modalFollowupContent.classList.toggle('bg-red-50', post.followUpError);
   this.elements.modalFollowupContent.classList.toggle('text-red-700', post.followUpError);
   this.elements.modalFollowupContent.classList.toggle('bg-blue-50', !post.followUpError);
   this.elements.modalFollowupContent.classList.toggle('text-gray-800', !post.followUpError);
} else {
   this.elements.modalFollowupWrapper.classList.add('hidden');
  }
 
  this.renderModalGallery(postId);
  this.elements.modalOverlay.classList.remove('hidden');
setTimeout(() => {
   this.elements.modalOverlay.classList.remove('opacity-0');
   this.elements.modalContainer.classList.remove('scale-95', 'opacity-0');
  }, 10);
 }

 closeModal() {
  this.openModalPostId = null;
// [신규] 모달 비디오 플레이어 정리 (메모리 누수 방지)
  const videoPlayer = this.elements.modalVideoPlayer;
if (videoPlayer && videoPlayer.src) {
   videoPlayer.pause();
   URL.revokeObjectURL(videoPlayer.src);
   videoPlayer.src = '';
  }
  
  this.elements.modalContainer.classList.add('scale-95', 'opacity-0');
  this.elements.modalOverlay.classList.add('opacity-0');
setTimeout(() => { this.elements.modalOverlay.classList.add('hidden'); }, 300);
 }

 openVideoModal(videoUrl) {
  const player = this.elements.videoPreviewPlayer;
  if (!player) return;
 
  player.src = videoUrl;
this.elements.videoModalOverlay.classList.remove('hidden');
  setTimeout(() => {
   this.elements.videoModalOverlay.classList.remove('opacity-0');
   this.elements.videoModalContainer.classList.remove('scale-95', 'opacity-0');
   player.play();
  }, 10);
}

 closeVideoModal() {
  const player = this.elements.videoPreviewPlayer;
  if (player && player.src) {
   player.pause();
// [중요] 모달을 닫을 때만 URL 해제
   URL.revokeObjectURL(player.src);
   player.src = '';
  }
 
  this.elements.videoModalContainer.classList.add('scale-95', 'opacity-0');
  this.elements.videoModalOverlay.classList.add('opacity-0');
setTimeout(() => { this.elements.videoModalOverlay.classList.add('hidden'); }, 300);
 }

 async renderModalGallery(postId) {
  const gallery = this.elements.modalImageGallery;
  const galleryWrapper = this.elements.modalImageGalleryWrapper;
// [신규] 비디오 로더
  const videoWrapper = this.elements.modalVideoWrapper;
  const videoPlayer = this.elements.modalVideoPlayer;
  const videoDeleteBtn = this.elements.modalVideoDeleteBtn;
// [신규] 비디오 로드 시도
  try {
   const videoBlob = await window.app.imageDB.getVideo(postId);
if (videoBlob) {
    const url = URL.createObjectURL(videoBlob);
    videoPlayer.src = url;
videoDeleteBtn.onclick = () => {
     // 기존 URL 해제 후 앱 핸들러 호출
     if (videoPlayer.src) {
      URL.revokeObjectURL(videoPlayer.src);
}
     videoPlayer.src = '';
     window.app.handleDeleteVideo(postId); // App.js의 핸들러 호출
    };
    videoWrapper.classList.remove('hidden');
} else {
    // [수정] 비디오가 없을 때 src를 비우고 숨김
    if (videoPlayer.src) {
     URL.revokeObjectURL(videoPlayer.src);
}
    videoPlayer.src = '';
    videoWrapper.classList.add('hidden');
   }
  } catch (e) {
   console.error("모달 비디오 로드 실패:", e);
videoWrapper.classList.add('hidden');
  }

  // --- 기존 이미지 갤러리 로직 ---
  gallery.innerHTML = '<p class="text-gray-500 col-span-full">이미지 로드 중...</p>';
  galleryWrapper.classList.remove('hidden');
try {
   const images = await window.app.imageDB.getImagesForPost(postId);
   if (images.length === 0) {
    gallery.innerHTML = '<p class="text-gray-500 col-span-full">업로드된 이미지가 없습니다.</p>';
return;
   }
  
   gallery.innerHTML = '';
   images.forEach(imgData => {
    const url = URL.createObjectURL(imgData.blob);
   
    const wrapper = this.createDOMElement('div', 'relative group shadow-sm rounded-md overflow-hidden', '');
   
    const imgEl = this.createDOMElement('img', 'w-full h-auto object-cover cursor-pointer', '');
    imgEl.src = url;
    imgEl.style.minHeight = '100px';
    imgEl.title = `(${imgData.type}) 클릭하여 복사`;
    imgEl.onload = () => URL.revokeObjectURL(url);
    imgEl.onclick = () => {
      window.app.imageDB.copyImageToClipboard(imgData.blob)
      .then(() => this.showToast("이미지가 클립보드에 복사되었습니다.", "success"))
      .catch(e => this.showToast(e.message, "error"));
    };

    const deleteBtn = this.createDOMElement('button',
     'absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full leading-none opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-700',
     '<i class="bi bi-trash" style="font-size: 0.75rem; vertical-align: middle;"></i>'
    );
    deleteBtn.title = "이미지 삭제";
deleteBtn.onclick = (e) => {
     e.stopPropagation();
     window.app.handleDeleteImage(imgData.id, postId);
    };
   
    wrapper.appendChild(imgEl);
    wrapper.appendChild(deleteBtn);
    gallery.appendChild(wrapper);
   });
} catch (e) {
   console.error("이미지 갤러리 로드 실패:", e);
   gallery.innerHTML = '<p class="text-red-500 col-span-full">이미지 로드 중 오류가 발생했습니다.</p>';
}
 }

 // [수정] 하단 푸터 업데이트
 updateJobFooter(activelyProcessingJobs, jobQueueLength, localVideoJob = null) {
  // [신규] 로컬 작업 상태 반영
  if (localVideoJob) {
   this.localVideoJob = localVideoJob;
}

  const activeApiJobs = Array.from(activelyProcessingJobs.values());
 
  if (activeApiJobs.length === 0 && jobQueueLength === 0 && !this.localVideoJob) {
   this.elements.jobFooterBar.classList.remove('show');
return;
  }
 
  this.elements.jobFooterBar.classList.add('show');
  const list = this.elements.processingList;
  list.innerHTML = '';
// [신규] 로컬 비디오 작업을 최우선으로 표시
  if (this.localVideoJob) {
   list.appendChild(this.createDOMElement('span', 'processing-item bg-purple-600', `
    <svg class="animate-spin spinner-sm text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
     <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
     <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    ${this.localVideoJob.status}
   `));
}
 
  // API 작업 표시
  let count = 0;
for (const job of activeApiJobs) {
   if (count >= 2) { // 로컬 작업이 있을 수 있으니 API 작업은 2개로 축소
    list.innerHTML += `<span class="processing-item">...외 ${activeApiJobs.length - count}개</span>`;
break;
   }
   list.appendChild(this.createDOMElement('span', 'processing-item', `
    <svg class="animate-spin spinner-sm text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
     <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
     <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    ${job.topic.substring(0, 20)}...
   `));
count++;
  }
 
  this.elements.queueStatusDisplay.textContent = (jobQueueLength > 0) ? `API 대기열: ${jobQueueLength}개` : ``;
}

 // [신규] 로컬 비디오 작업 상태 업데이트
 updateLocalVideoJobStatus(status) {
  if (status) {
   this.localVideoJob = { status: status };
} else {
   this.localVideoJob = null;
  }
 
  // App이 초기화되었는지 확인 후 JobManager 상태 가져오기
  const apiJobs = (window.app && window.app.jobManager) ?
window.app.jobManager.activelyProcessingJobs : new Map();
  const queueLength = (window.app && window.app.jobManager) ? window.app.jobManager.jobQueue.length : 0;
 
  this.updateJobFooter(apiJobs, queueLength, this.localVideoJob);
}


 // 5. 유틸리티
 createDOMElement(tag, className, html = '') {
  const el = document.createElement(tag);
  el.className = className;
el.innerHTML = html;
  return el;
 }

 // ✨ [수정] updateIconStatus (더 이상 async 아님)
 updateIconStatus(post) {
  // 1. Get elements
  const imgBtn = document.getElementById(`btn-image-${post.id}`);
const videoBtn = document.getElementById(`btn-video-${post.id}`);
  const badge = document.getElementById(`image-count-${post.id}`);

  // 2. Check images (Button + Badge)
  if (imgBtn && badge) {
   // app.js에서 보강한 데이터를 직접 사용
   const count = post._imageCount ||
0;
   imgBtn.classList.toggle('icon-btn-active', count > 0);
   
   if (count > 0) {
    badge.textContent = `${count}개 이미지`;
    badge.classList.remove('hidden');
} else {
    badge.textContent = '';
    badge.classList.add('hidden');
}
  }

  // 3. Check video
  if (videoBtn) {
   // app.js에서 보강한 데이터를 직접 사용
   videoBtn.classList.toggle('icon-btn-active', post._hasVideo === true);
}
 }
 
 // ✨ [신규] 필터 체크박스 렌더링
 renderFilters(filters) {
  const filterMap = {
   status: [
    { value: 'incomplete', label: '후속 작업 대기' },
    { value: 'complete', label: '후속 작업 완료' },
    { value: 'failed', label: '실패' }
   ],
   video: [
    { value: 'yes', label: '있음' },
    { value: 'no', label: '없음' }
   ]
  };
// 헬퍼 함수
  const renderGroup = (groupKey, options) => {
   const container = this.elements[`filterGroup${groupKey.charAt(0).toUpperCase() + groupKey.slice(1)}`];
if (!container) return;
   
   container.innerHTML = '';
   options.forEach(option => {
    const isChecked = filters[groupKey].includes(option.value);
    const el = this.createDOMElement('label', 'flex items-center space-x-2 cursor-pointer text-sm', `
     <input type="checkbox" ${isChecked ? 'checked' : ''} class="rounded text-blue-600 focus:ring-blue-500">
     <span>${option.label}</span>
    `);
    el.querySelector('input').onchange = () => {
     window.app.updateFilter(groupKey, option.value);
    };
    container.appendChild(el);
   });
};

  renderGroup('status', filterMap.status);
  renderGroup('video', filterMap.video);
 }
 
 // ✨ [신규] 선택된 필터 태그 렌더링
 renderFilterTags(filters) {
  const container = this.elements.filterTagContainer;
if (!container) return;
  container.innerHTML = '';

  const labels = {
   status: { 'incomplete': '대기', 'complete': '완료', 'failed': '실패' },
   video: { 'yes': '동영상 있음', 'no': '동영상 없음' }
  };
// 헬퍼 함수
  const createTag = (key, value, label) => {
   const el = this.createDOMElement('span', 'flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm', `
    <span>${label}</span>
    <button class="ml-1.5 text-blue-600 hover:text-blue-800 focus:outline-none">
     <i class="bi bi-x" style="font-size: 1rem; vertical-align: middle;"></i>
    </button>
   `);
el.querySelector('button').onclick = () => {
    window.app.clearFilter(key, value);
   };
   container.appendChild(el);
  };
// 상태 필터 태그
  filters.status.forEach(value => {
   createTag('status', value, `상태: ${labels.status[value]}`);
  });
// 비디오 필터 태그
  filters.video.forEach(value => {
   createTag('video', value, labels.video[value]);
  });
// '초기화' 버튼
  if (filters.status.length > 0 || filters.video.length > 0) {
   const resetEl = this.createDOMElement('button', 'text-sm text-gray-500 hover:text-red-600 underline', '전체 초기화');
resetEl.onclick = () => {
    window.app.clearFilter('status');
    window.app.clearFilter('video');
   };
   container.appendChild(resetEl);
}
 }

 // ✨ [신규] BGM 상태 렌더링
 renderBGMStatus(file) {
  const container = this.elements.bgmStatusContainer;
  if (!container) return;

  if (file) {
   container.innerHTML = `
    <div class="flex items-center justify-between">
     <div class="flex items-center space-x-2">
      <i class="bi bi-music-note-beamed text-green-600 text-lg"></i>
      <span class="text-sm font-medium text-gray-700" title="${file.name}">${file.name.length > 30 ? file.name.substring(0, 30) + '...' : file.name}</span>
     </div>
     <button class="icon-btn icon-btn-danger" title="BGM 삭제">
      <i class="bi bi-trash"></i>
     </button>
    </div>
   `;
   container.querySelector('button').onclick = () => window.app.handleDeleteBGM();
  } else {
   container.innerHTML = `<p class="text-sm text-gray-500">저장된 BGM이 없습니다. (MP3)</p>`;
  }
 }
 
 // ✨ [신규] 기본 이미지 갤러리 렌더링
 renderDefaultImages(images) {
  const gallery = this.elements.defaultImageGallery;
  if (!gallery) return;
  
  if (images.length === 0) {
   gallery.innerHTML = '<p class="text-xs text-gray-400 col-span-full text-center py-2">등록된 기본 이미지가 없습니다.</p>';
   return;
  }
  
  gallery.innerHTML = '';
  images.forEach(imgData => {
   const url = URL.createObjectURL(imgData.blob);
  
   const wrapper = this.createDOMElement('div', 'relative group shadow-sm rounded-md overflow-hidden', '');
  
   const imgEl = this.createDOMElement('img', 'w-full h-16 object-cover', '');
   imgEl.src = url;
   imgEl.title = imgData.name;
   imgEl.onload = () => URL.revokeObjectURL(url);

   const deleteBtn = this.createDOMElement('button',
    'absolute top-0.5 right-0.5 p-0.5 bg-red-600 text-white rounded-full leading-none opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-700',
    '<i class="bi bi-x" style="font-size: 0.65rem; vertical-align: middle;"></i>'
   );
   deleteBtn.title = "기본 이미지 삭제";
   deleteBtn.onclick = (e) => {
    e.stopPropagation();
    window.app.handleDeleteDefaultImage(imgData.id);
   };
  
   wrapper.appendChild(imgEl);
   wrapper.appendChild(deleteBtn);
   gallery.appendChild(wrapper);
  });
 }
}