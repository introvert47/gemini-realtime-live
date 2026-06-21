// Check for browser support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  alert("Web Speech API is not supported in this browser. Try Chrome or Safari Mobile!");
}

const recognition = new SpeechRecognition();
recognition.continuous = false; // Process utterance by utterance
recognition.interimResults = false;
recognition.lang = 'en-US';

const synth = window.speechSynthesis;
let isAiSpeaking = false;

// 1. Automatically start listening as soon as the page loads
window.addEventListener('load', () => {
  startListeningLoop();
});

function startListeningLoop() {
  if (!isAiSpeaking) {
    try {
      recognition.start();
      console.log("Listening for your voice...");
    } catch (e) {
      // Catch errors if it's already running
    }
  }
}

// 2. Capture speech result and instantly trigger backend send
recognition.onresult = async (event) => {
  const userText = event.results[0][0].transcript;
  console.log("You said:", userText);

  if (userText.trim().length > 0) {
    // Take a snapshot from your existing video element
    const imageFrameData = captureWebcamFrame(); 

    // Stop recognition so it doesn't listen to its own voice or background noise
    recognition.stop(); 
    
    // Call your existing function that talks to your /api backend
    await sendToGeminiBackend(userText, imageFrameData);
  }
};

// 3. Restart listening if it idles out or stops without a result
recognition.onend = () => {
  if (!isAiSpeaking) {
    startListeningLoop();
  }
};

// 4. Function to speak Gemini's reply out loud
function speakApiResponse(text) {
  isAiSpeaking = true;
  recognition.stop(); // Absolute safety check

  const utterance = new SpeechSynthesisUtterance(text);
  
  utterance.onend = () => {
    isAiSpeaking = false;
    // Turn the microphone back on immediately after speaking finishes!
    startListeningLoop(); 
  };

  utterance.onerror = () => {
    isAiSpeaking = false;
    startListeningLoop();
  };

  synth.speak(utterance);
}

// NOTE: Make sure inside your existing backend response handler, 
// you call `speakApiResponse(data.reply)` instead of just printing it on screen!