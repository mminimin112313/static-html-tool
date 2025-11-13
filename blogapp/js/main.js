// Firebase SDK 모듈 임포트
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
 getAuth,
 signInAnonymously,
 signInWithPopup,
 GoogleAuthProvider,
 signOut,
 onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
 getFirestore, doc, addDoc, setDoc, updateDoc, deleteDoc,
 onSnapshot, collection, query, serverTimestamp, setLogLevel
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 메인 App 클래스 임포트
import App from './app.js'; // ✨ 이제 이 App은 UIManager가 아닌 진짜 컨트롤러입니다.

/**
* ================================================================
* === 애플리케이션 시작점 ===
* ================================================================
*/

document.addEventListener('DOMContentLoaded', () => {
 const app = new App();

 // 전역 스코프에 app 할당 (HTML onclick 등에서 사용)
 window.app = app;

 // --- [신규] 설정 저장 버튼은 app.init()과 관계없이 즉시 바인딩 ---
 // 이 버튼이 눌려야만 app.init()을 호출할 수 있으므로, 여기서 수동 연결합니다.
 // --- [수정] 설정 저장 버튼은 app.init()과 관계없이 즉시 바인딩 ---
 // UIManager(app) 인스턴스의 showToast를 직접 활용하여 저장 로직을 구현합니다.
 document.getElementById('save-firebase-config-button').onclick = () => {
  const configInput = document.getElementById('firebase-config-input');
  const configString = configInput.value;

  if (!configString) {
   // ✨ 수정됨: app 인스턴스의 ui 속성에 있는 showToast를 호출합니다.
   app.ui.showToast("Firebase 설정을 입력하세요.", "error");
   return;
  }
  try {
   // 1. JSON 유효성 검사
   const firebaseConfig = JSON.parse(configString);
   // 2. LocalStorage에 저장
   localStorage.setItem('firebaseConfig', JSON.stringify(firebaseConfig));
   // 3. UIManager의 showToast로 성공 알림
   // ✨ 수정됨: app.ui.showToast
   app.ui.showToast("설정이 저장되었습니다. 페이지를 새로고침합니다.", "success");
   // 4. 새로고침
   setTimeout(() => location.reload(), 1000);
  } catch (e) {
   // 5. UIManager의 showToast로 실패 알림
   // ✨ 수정됨: app.ui.showToast
   app.ui.showToast(`설정 저장 실패: ${e.message}`, "error");
  }
 };


 const configString = localStorage.getItem('firebaseConfig');

 if (!configString) {
  // --- 설정이 없을 경우 ---
  const errorMsg = "Firebase 설정이 없습니다. '설정' 탭에서 입력해주세요.";
  console.warn(errorMsg);
 
  // DOM을 직접 조작하여 초기 상태 설정
  // ✨ [수정] app.ui의 showMainView를 직접 호출하여 초기 상태 설정
 app.ui.showMainView('settings');
 
 // app.init()이 호출되지 않았으므로 수동으로 탭 비활성화
 const navInput = document.getElementById('nav-input');
 const navResults = document.getElementById('nav-results');
 
 if (navInput) {
  navInput.disabled = true;
  navInput.classList.add('opacity-50', 'cursor-not-allowed');
 }
 if (navResults) {
  navResults.disabled = true;
  navResults.classList.add('opacity-50', 'cursor-not-allowed');
 }
 } else {
  // --- 설정이 있을 경우 ---
  try {
   const firebaseConfig = JSON.parse(configString);
  
   document.getElementById('firebase-config-input').value = JSON.stringify(firebaseConfig, null, 2);
  
   const firebaseServices = {
    initializeApp,
    getAuth, signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged,
    getFirestore, doc, addDoc, setDoc, updateDoc, deleteDoc,
    onSnapshot, collection, query, serverTimestamp, setLogLevel
   };
   
   // ✨ app.init() 호출: 이제 app은 컨트롤러 인스턴스입니다.
   app.init(firebaseConfig, firebaseServices); // App 초기화
  
  } catch (e) {
   console.error("Firebase 설정 파싱 오류:", e.message);
   alert("저장된 Firebase 설정이 잘못되었습니다. 다시 입력해주세요.");
   localStorage.removeItem('firebaseConfig');
  
   // ✨ [수정] 새 탭 구조에 맞게 오류 UI 표시
   app.ui.showMainView('settings');
   const navInput = document.getElementById('nav-input');
   const navResults = document.getElementById('nav-results');
   
   if (navInput) {
    navInput.disabled = true;
    navInput.classList.add('opacity-50', 'cursor-not-allowed');
   }
   if (navResults) {
    navResults.disabled = true;
    navResults.classList.add('opacity-50', 'cursor-not-allowed');
   }
  }
 }
});