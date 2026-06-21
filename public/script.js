const video = document.getElementById('webcam');
const askBtn = document.getElementById('askBtn');
const promptInput = document.getElementById('promptInput');
const responseText = document.getElementById('responseText');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const canvas = document.getElementById('captureCanvas');
const ctx = canvas.getContext('2d');

// 1. Prompt your system to grab webcam/phone input stream
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 }, 
            audio: false 
        });
        video.srcObject = stream;
    } catch (err) {
        console.error("Camera hook failed:", err);
        responseText.innerText = "Could not activate camera stream.";
        statusText.innerText = "OFFLINE";
        statusDot.style.background = "#f38ba8"; // Red alert color
    }
}

// 2. Local Native Audio Text-to-Speech Output
function triggerVoiceSynth(message) {
    window.speechSynthesis.cancel(); // Flush old processes
    const utter = new SpeechSynthesisUtterance(message);
    window.speechSynthesis.speak(utter);
}

// 3. Process Event Dispatching
askBtn.addEventListener('click', async () => {
    // Switch state UI to active thinking
    askBtn.disabled = true;
    statusDot.classList.add('thinking');
    statusText.innerText = "AI THINKING...";
    responseText.innerText = "Analyzing what you show me...";

    // Snap current canvas capture matrix from video element
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: dataUrl,
                prompt: promptInput.value
            })
        });

        const data = await response.json();

        if (data.text) {
            responseText.innerText = data.text;
            triggerVoiceSynth(data.text);
        } else {
            responseText.innerText = "Error parsing response: " + data.error;
        }
    } catch (err) {
        console.error(err);
        responseText.innerText = "Connection lost to your local backend.";
    } finally {
        // Return back to tracking loop
        askBtn.disabled = false;
        statusDot.classList.remove('thinking');
        statusText.innerText = "AI WATCHING";
    }
});

initCamera();