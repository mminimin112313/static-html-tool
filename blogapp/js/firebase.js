/**
* ================================================================
* 클래스 2: FirebaseService - Firebase 인증 및 Firestore 전담
* (Axiom: Single Responsibility Principle)
* ================================================================
*/
export default class FirebaseService {
 constructor(config, firebaseServices, onAuthChangeCallback) {
  // 주입받은 Firebase SDK 함수들
  this.sdk = firebaseServices;
this.app = this.sdk.initializeApp(config);
  this.db = this.sdk.getFirestore(this.app);
  this.auth = this.sdk.getAuth(this.app);
  this.sdk.setLogLevel('debug');
// 'info' 또는 'warn'으로 변경 가능
 
  this.config = config;
  this.userId = null;
  this.collections = {};
 
  this.listeners = {};
// Firestore 리스너 구독 해제용
 
  this.sdk.onAuthStateChanged(this.auth, (user) => {
   this.userId = user ? user.uid : null;
   if (user) {
    this.setCollectionRefs();
   }
   onAuthChangeCallback(user);
  });
}

 setCollectionRefs() {
  const appId = this.config?.appId || 'default-app-id';
  if (!this.userId || !appId) return;
// Firestore 경로를 앱 ID와 사용자 ID로 분리하여 데이터 격리
  const userBasePath = `artifacts/${appId}/users/${this.userId}`;
this.collections = {
   keysCol: this.sdk.collection(this.db, `${userBasePath}/apiKeys`),
   templatesCol: this.sdk.collection(this.db, `${userBasePath}/templates`),
   followUpTemplatesCol: this.sdk.collection(this.db, `${userBasePath}/followUpTemplates`),
   postsCol: this.sdk.collection(this.db, `${userBasePath}/generatedPosts`)
  };
}

 // 1. 인증
 async handleGoogleLogin() {
  const provider = new this.sdk.GoogleAuthProvider();
  try { await this.sdk.signInWithPopup(this.auth, provider);
}
  catch (error) { console.error("Google 로그인 실패:", error); throw error;
}
 }

 async handleAnonymousLogin() {
  try { await this.sdk.signInAnonymously(this.auth); }
  catch (error) { console.error("익명 로그인 실패:", error);
throw error; }
 }

 async handleLogout() {
  try { await this.sdk.signOut(this.auth); }
  catch (error) { console.error("로그아웃 실패:", error);
throw error; }
 }

 // 2. 리스너 (데이터 실시간 감지)
 listenToData(collectionName, callback) {
  const col = this.collections[collectionName];
if (!col) return;
 
  // 기존 리스너가 있다면 구독 해제
  if (this.listeners[collectionName]) {
   this.listeners[collectionName]();
}
 
  const q = this.sdk.query(col);
  this.listeners[collectionName] = this.sdk.onSnapshot(q, (snapshot) => {
   const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
   callback(data);
  }, (e) => console.error(`${collectionName} 로드 실패:`, e));
}

 stopAllListeners() {
  for (const unsub of Object.values(this.listeners)) {
   unsub();
  }
  this.listeners = {};
}

 // 3. API 키 CRUD
 async addApiKey(key) {
  if (!key) throw new Error("API 키를 입력하세요.");
await this.sdk.addDoc(this.collections.keysCol, {
   key: key, status: 'ready', lastUsed: null,
   createdAt: this.sdk.serverTimestamp(), backoffLevel: 0, failureCount: 0
  });
}
 async deleteApiKey(id) {
  await this.sdk.deleteDoc(this.sdk.doc(this.db, this.collections.keysCol.path, id));
 }
 async resetApiKey(id) {
  const keyDoc = this.sdk.doc(this.db, this.collections.keysCol.path, id);
// 상태, 실패 카운트, 백오프 레벨, 마지막 사용 시간을 모두 초기화
  await this.sdk.updateDoc(keyDoc, { status: 'ready', failureCount: 0, backoffLevel: 0, lastUsed: null });
}
 async updateApiKeyStatus(id, status, extraData = {}) {
  // 'ready' 상태로 업데이트 시, 실패 카운트와 백오프 레벨을 자동으로 초기화
  if (status === 'ready') {
   extraData = { ...extraData, failureCount: 0, backoffLevel: 0 };
}
 
  const keyDoc = this.sdk.doc(this.db, this.collections.keysCol.path, id);
  const updateData = { status: status, ...extraData };
if (['busy', 'cooldown', 'dead'].includes(status)) {
   updateData.lastUsed = this.sdk.serverTimestamp();
  }
  await this.sdk.updateDoc(keyDoc, updateData);
}

 // 4. 템플릿 CRUD
 async saveTemplate(id, name, content) {
  if (!name || !content) throw new Error("이름과 내용을 모두 입력하세요.");
const data = { name, content };
  if (id) {
   await this.sdk.setDoc(this.sdk.doc(this.db, this.collections.templatesCol.path, id), data, { merge: true });
} else {
   await this.sdk.addDoc(this.collections.templatesCol, data);
  }
 }
 async deleteTemplate(id) {
  await this.sdk.deleteDoc(this.sdk.doc(this.db, this.collections.templatesCol.path, id));
}

 // 5. 후속 템플릿 (단일) CRUD
 async saveSingleFollowUpTemplate(name, content) {
  // 기존 템플릿을 찾기 위해 현재 데이터를 읽음 (단일 템플릿이므로)
  let existingTemplateId = null;
try {
    const snapshot = await this.sdk.getDocs(this.sdk.query(this.collections.followUpTemplatesCol));
if (!snapshot.empty) {
      existingTemplateId = snapshot.docs[0].id;
}
  } catch (e) { console.error("기존 후속 템플릿 조회 실패:", e);
}

  if (!name || !content) {
   if (existingTemplateId) {
    // 이름이나 내용이 비어있으면 기존 템플릿 삭제
    await this.sdk.deleteDoc(this.sdk.doc(this.db, this.collections.followUpTemplatesCol.path, existingTemplateId));
return 'deleted';
   }
   throw new Error("이름과 내용을 모두 입력하세요.");
}
  if (!content.includes('{글}')) throw new Error("템플릿에 {글} 변수가 포함되어야 합니다.");
 
  const data = { name, content };
if (existingTemplateId) {
   await this.sdk.setDoc(this.sdk.doc(this.db, this.collections.followUpTemplatesCol.path, existingTemplateId), data, { merge: true });
   return 'updated';
} else {
   await this.sdk.addDoc(this.collections.followUpTemplatesCol, data);
   return 'created';
}
 }

 // 6. 결과물 CRUD
 async saveGeneratedPost(job, content, error = false) {
  const docRef = await this.sdk.addDoc(this.collections.postsCol, {
   topic: job.topic, content, error, createdAt: this.sdk.serverTimestamp(),
   isFollowUpComplete: false, followUpResult: null, followUpError: false,
   originalJob: { type: job.type, prompt: job.prompt }
  });
  return docRef.id; // ✨ [신규] 생성된 문서 ID 반환
}
 async updatePostWithFollowUp(job, resultText, isError = false) {
  const postDoc = this.sdk.doc(this.db, this.collections.postsCol.path, job.originalPostId);
await this.sdk.updateDoc(postDoc, {
   followUpResult: resultText, isFollowUpComplete: true, followUpError: isError,
   originalFollowUpJob: { type: job.type, prompt: job.prompt }
  });
}
 async updatePostAfterRetry(postId) {
  const postDoc = this.sdk.doc(this.db, this.collections.postsCol.path, postId);
await this.sdk.updateDoc(postDoc, {
   isFollowUpComplete: false, followUpError: false, followUpResult: null
  });
}
 async deleteGeneratedPost(id) {
  await this.sdk.deleteDoc(this.sdk.doc(this.db, this.collections.postsCol.path, id));
 }
}