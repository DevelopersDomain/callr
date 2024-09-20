var start = document.querySelector('.start-btn');
var stop = document.querySelector('.stop-btn');
var recordingsList = document.getElementById('recordings-list');
var cameraVideo = document.getElementById('cameraVideo');
var data = [];
var cameraIncluded = false;
var recorder;
var selectedCamera, selectedMicrophone;

// Populate camera and microphone options on modal open
start.addEventListener('click', async () => {
    await populateDevices();
    document.getElementById('cameraModal').style.display = 'block';
});

// Function to populate camera and microphone options
async function populateDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameraSelect = document.getElementById('cameraSelect');
    const microphoneSelect = document.getElementById('microphoneSelect');

    cameraSelect.innerHTML = '';
    microphoneSelect.innerHTML = '';

    devices.forEach(device => {
        if (device.kind === 'videoinput') {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Camera ${cameraSelect.length + 1}`;
            cameraSelect.appendChild(option);
        } else if (device.kind === 'audioinput') {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${microphoneSelect.length + 1}`;
            microphoneSelect.appendChild(option);
        }
    });
}

// Handle camera inclusion
document.getElementById('includeCamera').addEventListener('click', async () => {
    cameraIncluded = true;
    selectedCamera = document.getElementById('cameraSelect').value;
    selectedMicrophone = document.getElementById('microphoneSelect').value;
    await requestPermissions();
    document.getElementById('cameraModal').style.display = 'none';
    startRecording();
});

document.getElementById('excludeCamera').addEventListener('click', async () => {
    cameraIncluded = false;
    selectedMicrophone = document.getElementById('microphoneSelect').value;
    await requestPermissions();
    document.getElementById('cameraModal').style.display = 'none';
    startRecording();
});

// Function to request permissions for screen, camera, and microphone
async function requestPermissions() {
    try {
        // Get the camera stream if included
        if (cameraIncluded) {
            const cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: selectedCamera ? { exact: selectedCamera } : undefined },
                audio: { deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined } // Include microphone audio
            });
            cameraVideo.srcObject = cameraStream; // Set camera stream to the camera video element
            cameraVideo.style.display = 'block'; // Show the camera video
        }

        // Get the screen recording permissions
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { mediaSource: 'screen' }
        });

        // Get the selected microphone stream
        const microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined }
        });

        // Combine the screen stream and microphone stream
        const combinedStream = new MediaStream([
            ...screenStream.getVideoTracks(),
            ...microphoneStream.getAudioTracks() // Add microphone audio track to the stream
        ]);

        // Set the screen stream to the recording video element
        var recordingVideo = document.querySelector('.recording');
        recordingVideo.srcObject = combinedStream;
        recordingVideo.style.display = 'block'; // Show the recording video

        // Automatically stop recording when the screen stream ends
        screenStream.getTracks().forEach(track => {
            track.onended = () => {
                if (recorder && recorder.state === "recording") {
                    stopRecording(); // Call the stop function
                }
            };
        });

        return combinedStream; // Return the combined stream for recording
    } catch (err) {
        console.error('Error getting permissions:', err);
    }
}

function startRecording() {
    const recordingVideoElement = document.querySelector('.recording');
    const combinedStream = recordingVideoElement.srcObject;

    if (!combinedStream) {
        console.error('Combined stream not available.');
        return;
    }

    // Create MediaRecorder for the combined screen and microphone stream
    recorder = new MediaRecorder(combinedStream);
    recorder.ondataavailable = (e) => data.push(e.data);
    recorder.start();

    start.disabled = true;
    stop.disabled = false;

    // Enter Picture-in-Picture for camera stream after screen share starts
    if (cameraIncluded) {
        cameraVideo.requestPictureInPicture().catch(err => {
            console.error('Error entering Picture-in-Picture:', err);
        });
    }

    // Stop recording on Stop button click
    stop.addEventListener('click', stopRecording);
}

function stopRecording() {
    if (recorder) {
        recorder.stop();

        // Handle saving the recording
        recorder.onstop = () => {
            let blobData = new Blob(data, { type: 'video/mp4' });
            let url = URL.createObjectURL(blobData);

            let listItem = document.createElement('li');
            let downloadBtn = document.createElement('a');
            downloadBtn.href = url;
            downloadBtn.download = 'recording.mp4';
            downloadBtn.textContent = 'Download';

            listItem.textContent = 'Recording ' + new Date().toLocaleTimeString();
            listItem.appendChild(downloadBtn);
            recordingsList.appendChild(listItem);

            // Hide camera and recording video previews
            cameraVideo.style.display = 'none'; // Hide the camera video
            document.querySelector('.recording').style.display = 'none'; // Hide the recording video

            // Turn off Picture-in-Picture mode
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture().catch(err => {
                    console.error('Error exiting Picture-in-Picture:', err);
                });
            }

            // Reset
            data = [];
            start.disabled = false;
            stop.disabled = true;

            // Stop all streams to remove permissions
            if (cameraVideo.srcObject) {
                cameraVideo.srcObject.getTracks().forEach(track => track.stop());
            }
            if (document.querySelector('.recording').srcObject) {
                document.querySelector('.recording').srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }
}
