const videoElement = document.getElementById('webcam');
const statusElement = document.getElementById('status');
const toggleCamBtn = document.getElementById('toggle-cam-btn');

let currentStream = null;
let useFacingMode = "user"; // "user" = front, "environment" = back
let isAiSpeaking = false;

// Initialize Web Speech APIs
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
const synth = window.speechSynthesis;

if (recognition) {
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
} else {
  statusElement.textContent = "Speech recognition not supported in this browser.";
}

// 1. Start Camera
async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }

  try {
    const constraints = {
      video: { 
        facingMode: useFacingMode,
        // Restrict camera resolution to avoid massive processing sizes
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    };
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = currentStream;
    statusElement.textContent = "Listening... Speak naturally!";
    startListeningLoop();
  } catch (err) {
    console.error("Camera error: ", err);
    statusElement.textContent = "Error accessing camera. Check permissions.";
  }
}

// Toggle between Front and Back Camera
toggleCamBtn.addEventListener('click', () => {
  useFacingMode = (useFacingMode === "user") ? "environment" : "user";
  startCamera();
});

// 2. Speech Recognition Loop Logic
function startListeningLoop() {
  if (!recognition || isAiSpeaking) return;
  try {
    recognition.start();
    statusElement.textContent = "Listening... Speak now.";
  } catch (e) {
    // Avoid breaking if already running
  }
}

if (recognition) {
  recognition.onresult = async (event) => {
    const userText = event.results[0][0].transcript;
    statusElement.textContent = `You said: "${userText}"... Processing...`;

    if (userText.trim().length > 0) {
      recognition.stop();
      
      // CAPTURE AND COMPRESS IMAGE HERE:
      const canvas = document.createElement('canvas');
      // Downscale canvas coordinates explicitly to 640x480
      canvas.width = 640;
      canvas.height = 480;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // Use jpeg format and compress down to 0.6 quality (60%) 
      // This shrinks the payload from megabytes down to just a few kilobytes!
      const compressedBase64Image = canvas.toDataURL('image/jpeg', 0.6);

      // Send optimized payload to backend
      await sendToGemini(userText, compressedBase64Image);
    }
  };

  recognition.onend = () => {
    if (!isAiSpeaking) {
      startListeningLoop();
    }
  };
}

// 3. Send Everything to Vercel Endpoint
async function sendToGemini(prompt, base64Data) {
  try {
    const response = await fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt, image: base64Data })
    });

    const data = await response.json();
    
    if (data && data.reply) {
      statusElement.textContent = "AI responding...";
      speakResponse(data.reply);
    } else {
      statusElement.textContent = "Error reading response from backend.";
      isAiSpeaking = false;
      startListeningLoop();
    }
  } catch (error) {
    console.error(error);
    statusElement.textContent = "Server communication failed. Retrying...";
    isAiSpeaking = false;
    startListeningLoop();
  }
}

// 4. Text to Speech Logic
function speakResponse(text) {
  isAiSpeaking = true;
  if (recognition) recognition.stop();

  const utterance = new SpeechSynthesisUtterance(text);
  
  utterance.onend = () => {
    isAiSpeaking = false;
    startListeningLoop();
  };

  utterance.onerror = () => {
    isAiSpeaking = false;
    startListeningLoop();
  };

  synth.speak(utterance);
}

window.addEventListener('load', startCamera);