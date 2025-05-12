const firebaseConfig = {
    apiKey: "<%= process.env.FIREBASE_API_KEY %>",
    authDomain: "<%= process.env.FIREBASE_AUTH_DOMAIN %>",
    projectId: "<%= process.env.FIREBASE_PROJECT_ID %>",
    storageBucket: "<%= process.env.FIREBASE_STORAGE_BUCKET %>",
    messagingSenderId: "<%= process.env.FIREBASE_SENDER_ID %>",
    appId: "<%= process.env.FIREBASE_APP_ID %>"
  };
  
  const app = firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  let confirmationResult;
  
  // Initialize Recaptcha
  window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
    size: 'normal',
    callback: () => {
      document.getElementById('otpSection').classList.remove('hidden');
    }
  });
  
  // Send OTP
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const phoneNumber = document.getElementById('phone').value;
    
    signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier)
      .then((confirmation) => {
        confirmationResult = confirmation;
      })
      .catch((error) => {
        console.error('Error sending OTP:', error);
      });
  });
  
  // Verify OTP
  document.getElementById('verifyOtpForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const otp = document.getElementById('otp').value;
    
    confirmationResult.confirm(otp)
      .then((result) => {
        window.location.href = '/dashboard';
      })
      .catch((error) => {
        console.error('Error verifying OTP:', error);
      });
  });