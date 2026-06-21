const videoElement = document.getElementById('webcam');
const statusElement = document.getElementById('status');
const toggleCamBtn = document.getElementById('toggle-cam-btn');

let currentStream = null;
let useFacingMode = "user"; 
let isAiSpeaking = false;

// Initialize Web Speech APIs completely independently
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
const synth = window.speechSynthesis;

if (recognition) {
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
}

// 1. Mobile Speech Engine Unlock Trigger
window.addEventListener('click', () => {
  const unlockSpeech = new SpeechSynthesisUtterance("");
  synth.speak(unlockSpeech);
  
  // Start the voice listener immediately when the user interacts with the screen
  if (recognition && !isAiSpeaking) {
    startListeningLoop();
  }
}, { once: true });

// 2. Separate Camera Engine Flow
async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }

  try {
    const constraints = {
      video: { 
        facingMode: useFacingMode,
        width: { ideal: 320 }, 
        height: { ideal: 240 }
      },
      audio: false
    };
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = currentStream;
    statusElement.textContent = "Tap screen once, then speak freely!";
  } catch (err) {
    console.error(err);
    statusElement.textContent = "Voice only mode active (Camera blocked). Tap screen to start!";
  }
}

toggleCamBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // Avoid triggering the window click listener accidentally
  useFacingMode = (useFacingMode === "user") ? "environment" : "user";
  startCamera();
});

// 3. Audio Loop Control
function startListeningLoop() {
  if (!recognition || isAiSpeaking) return;
  try {
    recognition.start();
    statusElement.textContent = "Listening... Speak now.";
  } catch (e) {}
}

if (recognition) {
  recognition.onresult = async (event) => {
    const userText = event.results[0][0].transcript;
    statusElement.textContent = `Processing your voice request...`;

    if (userText.trim().length > 0) {
      recognition.stop();
      
      let compressedBase64Image = null;
      
      // Only attempt to read frames if the camera successfully initialized
      if (currentStream && videoElement.videoWidth > 0) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 240;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(videoElement, 0, 0, 320, 240);
          compressedBase64Image = canvas.toDataURL('image/jpeg', 0.3);
        } catch (canvasErr) {
          console.error("Frame capture failed:", canvasErr);
        }
      }

      await sendToGemini(userText, compressedBase64Image);
    }
  };

  recognition.onend = () => {
    if (!isAiSpeaking) {
      startListeningLoop();
    }
  };
}

// 4. Send Packet to Serverless Endpoint
async function sendToGemini(prompt, base64Data) {
  try {
    const response = await fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt, image: base64Data })
    });

    const data = await response.json();
    
    if (data && data.reply) {
      speakResponse(data.reply);
    } else {
      statusElement.textContent = "Failed to parse response payload.";
      resetLoop();
    }
  } catch (error) {
    statusElement.textContent = "Communication failed.";
    resetLoop();
  }
}

function resetLoop() {
  isAiSpeaking = false;
  setTimeout(startListeningLoop, 1500);
}

// 5. Speech Synthesis Playback Handler
function speakResponse(text) {
  isAiSpeaking = true;
  if (recognition) recognition.stop();
  statusElement.textContent = "AI responding...";

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