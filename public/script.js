const videoElement = document.getElementById('webcam');
const statusElement = document.getElementById('status');
const toggleCamBtn = document.getElementById('toggle-cam-btn');

let currentStream = null;
let useFacingMode = "user"; 
let isAiSpeaking = false;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
const synth = window.speechSynthesis;

window.addEventListener('click', () => {
  const look = new SpeechSynthesisUtterance("");
  window.speechSynthesis.speak(look);
}, { once: true });

async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }

  try {
    const constraints = {
      video: { 
        facingMode: useFacingMode,
        width: { ideal: 320 }, // Drop source stream size to keep data small
        height: { ideal: 240 }
      },
      audio: false
    };
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = currentStream;
    statusElement.textContent = "System Ready. Speak now.";
    startListeningLoop();
  } catch (err) {
    statusElement.textContent = "Camera initialization blocked.";
  }
}

toggleCamBtn.addEventListener('click', () => {
  useFacingMode = (useFacingMode === "user") ? "environment" : "user";
  startCamera();
});

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
    statusElement.textContent = `Processing: "${userText}"`;

    if (userText.trim().length > 0) {
      recognition.stop();
      
      const canvas = document.createElement('canvas');
      // FIXED: Hardcode static absolute pixel dimensions to ignore mobile High-DPI upscaling
      canvas.width = 320;
      canvas.height = 240;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0, 320, 240);
      
      // Use maximum compression (0.3 quality) to force payload down to kilobytes
      const compressedBase64Image = canvas.toDataURL('image/jpeg', 0.3);

      await sendToGemini(userText, compressedBase64Image);
    }
  };

  recognition.onend = () => {
    if (!isAiSpeaking) {
      startListeningLoop();
    }
  };
}

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
    } else if (data && data.details) {
      statusElement.textContent = `Server Error: ${data.details}`;
      resetLoop();
    } else {
      statusElement.textContent = "Response parsing failed.";
      resetLoop();
    }
  } catch (error) {
    statusElement.textContent = "Payload size blocked connection.";
    resetLoop();
  }
}

function resetLoop() {
  isAiSpeaking = false;
  setTimeout(startListeningLoop, 2000);
}

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