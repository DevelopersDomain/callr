var room_id;
var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
var local_stream;
var screenStream;
let pollOptions = [];
var peer = null;
var currentPeer = null
var screenSharing = false
var conn = null;
function createRoom() {
    console.log("Creating Room")
    let room = document.getElementById("room-input").value;
    if (room == " " || room == "") {
        alert("Please enter room number")
        return;
    }
    room_id = room;
    peer = new Peer(room_id)
    peer.on('open', (id) => {
        console.log("Peer Room ID: ", id)
        getUserMedia({ video: true, audio: true }, (stream) => {
            console.log(stream);
            local_stream = stream;
            setLocalStream(local_stream)
        }, (err) => {
            console.log(err)
        })
        notify("Waiting for peer to join.")
    })
    peer.on('call', (call) => {
        call.answer(local_stream);
        call.on('stream', (stream) => {
            console.log("got call");
            console.log(stream);
            setRemoteStream(stream)
        })
        currentPeer = call;
    })
}

function setLocalStream(stream) {
    document.getElementById("local-vid-container").hidden = false;
    document.getElementById("poll-creation").hidden = false;
    let video = document.getElementById("local-video");
    video.srcObject = stream;
    video.muted = true;
    video.play();
}
function setScreenSharingStream(stream) {
    document.getElementById("screenshare-container").hidden = false;
    let video = document.getElementById("screenshared-video");

    video.srcObject = stream;
    video.muted = false;
    video.play();
}
function setRemoteStream(stream) {
    document.getElementById("remote-vid-container").hidden = false;
    let video = document.getElementById("remote-video");
    video.srcObject = stream;
    video.play();
}


function notify(msg) {
    let notification = document.getElementById("notification")
    notification.innerHTML = msg
    notification.hidden = false
    setTimeout(() => {
        notification.hidden = true;
    }, 3000)
}

function joinRoom() {
    console.log("Joining Room")
    let room = document.getElementById("room-input").value;
    if (room == " " || room == "") {
        alert("Please enter room number")
        return;
    }
    room_id = room;
    peer = new Peer()
    peer.on('open', (id) => {
        console.log("Connected room with Id: " + id)

        getUserMedia({ video: true, audio: true }, (stream) => {
            local_stream = stream;
            setLocalStream(local_stream)
            notify("Joining peer")
            let call = peer.call(room_id, stream)
            call.on('stream', (stream) => {
                setRemoteStream(stream);

            })
            currentPeer = call;
        }, (err) => {
            console.log(err)
        })

    })
}
function joinRoomWithoutCamShareScreen() {
    // join a call and drirectly share screen, without accesing camera
    console.log("Joining Room")
    let room = document.getElementById("room-input").value;
    if (room == " " || room == "") {
        alert("Please enter room number")
        return;
    }
    room_id = room;
    peer = new Peer()
    peer.on('open', (id) => {
        console.log("Connected with Id: " + id)

        const createMediaStreamFake = () => {
            return new MediaStream([createEmptyAudioTrack(), createEmptyVideoTrack({ width: 640, height: 480 })]);
        }

        const createEmptyAudioTrack = () => {
            const ctx = new AudioContext();
            const oscillator = ctx.createOscillator();
            const dst = oscillator.connect(ctx.createMediaStreamDestination());
            oscillator.start();
            const track = dst.stream.getAudioTracks()[0];
            return Object.assign(track, { enabled: false });
        }

        const createEmptyVideoTrack = ({ width, height }) => {
            const canvas = Object.assign(document.createElement('canvas'), { width, height });
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = "green";
            ctx.fillRect(0, 0, width, height);

            const stream = canvas.captureStream();
            const track = stream.getVideoTracks()[0];

            return Object.assign(track, { enabled: false });
        };

        notify("Joining peer")
        let call = peer.call(room_id, createMediaStreamFake())
        call.on('stream', (stream) => {
            setRemoteStream(stream);

        })

        currentPeer = call;
        startScreenShare();

    })
}

function joinRoomShareVideoAsStream() {
    // Play video from local media
    console.log("Joining Room")
    let room = document.getElementById("room-input").value;
    if (room == " " || room == "") {
        alert("Please enter room number")
        return;
    }

    room_id = room;
    peer = new Peer()
    peer.on('open', (id) => {
        console.log("Connected with Id: " + id)

        document.getElementById("local-mdeia-container").hidden = false;
        
        const video = document.getElementById('local-media');
        video.onplay = function () {
            const stream = video.captureStream();
            notify("Joining peer")
            let call = peer.call(room_id, stream)

            // Show remote stream on my side
            call.on('stream', (stream) => {
                setRemoteStream(stream);

            })
        };
        video.play();
    })
}

function startScreenShare() {
    if (screenSharing) {
        stopScreenSharing()
    }
    navigator.mediaDevices.getDisplayMedia({ video: true ,audio: true }).then((stream) => {
        let call = peer.call(room_id, stream)
            call.on('stream', (stream) => {
                setScreenSharingStream(stream);

            })
        setScreenSharingStream(stream);

        screenStream = stream;
        let videoTrack = screenStream.getVideoTracks()[0];
        videoTrack.onended = () => {
            stopScreenSharing()
        }
        if (peer) {
            let sender = currentPeer.peerConnection.getSenders().find(function (s) {
                return s.track.kind == videoTrack.kind;
            })
            sender.replaceTrack(videoTrack)
            screenSharing = true
        }
        console.log(screenStream)
        
    })
}

function stopScreenSharing() {
    if (!screenSharing) return;
    let videoTrack = local_stream.getVideoTracks()[0];
    if (peer) {
        let sender = currentPeer.peerConnection.getSenders().find(function (s) {
            return s.track.kind == videoTrack.kind;
        })
        sender.replaceTrack(videoTrack)
    }
    screenStream.getTracks().forEach(function (track) {
        track.stop();
    });
    screenSharing = false
    document.getElementById("screenshare-container").hidden = true;
}
function leaveMeeting() {
    // Close the current Peer connection
    if (peer) {
        peer.disconnect();
        peer.destroy();
        peer = null;
    }

    // Stop local video and screen sharing
    if (local_stream) {
        local_stream.getTracks().forEach(function(track) {
            track.stop();
        });
        local_stream = null;
    }

    // Stop screen sharing if active
    if (screenSharing) {
        stopScreenSharing();
    }

    // Hide video containers
    document.getElementById("local-vid-container").hidden = true;
    document.getElementById("remote-vid-container").hidden = true;
    document.getElementById("screenshare-container").hidden = true;
    

    // Clear room ID input
    document.getElementById("room-input").value = "";

    // Hide notification
    document.getElementById("notification").hidden = true;
   

    // Reset currentPeer
    currentPeer = null;
}
// Function to mute/unmute audio
function toggleMute() {
    alert("Mute");
    if (!local_stream) return; // No local stream available

    const audioTracks = local_stream.getAudioTracks();
    audioTracks.forEach(track => {
        track.enabled = !track.enabled; // Toggle audio track enabled property
    });

    // Update UI to reflect mute/unmute state
    const muteButton = document.getElementById("mute-toggle-button");
    if (audioTracks.some(track => !track.enabled)) {
        // Audio is muted
        muteButton.textContent = "Unmute";
    } else {
        // Audio is unmuted
        muteButton.textContent = "Mute";
    }
}
// Function to turn camera on/off
function toggleCamera() {
    if (!local_stream) return; // No local stream available

    const videoTracks = local_stream.getVideoTracks();
    videoTracks.forEach(track => {
        track.enabled = !track.enabled; // Toggle video track enabled property
    });

    // Update UI to reflect camera on/off state
    const cameraToggleButton = document.getElementById("camera-toggle-button");
    if (videoTracks.some(track => !track.enabled)) {
        // Camera is turned off
        cameraToggleButton.textContent = "Turn Camera On";
    } else {
        // Camera is turned on
        cameraToggleButton.textContent = "Turn Camera Off";
    }
}
function addPollOption() {
    const pollOptionInput = document.getElementById('poll-option');
    const option = pollOptionInput.value.trim();
    alert(option);
    if (option !== '') {
        pollOptions.push(option);
        console.log(pollOptions);
        pollOptionInput.value = ''; // Clear input field
    }
}

// Function to create a poll
function createPoll() {
    console.log("create Pole with options: "+ pollOptions);
    if (pollOptions.length === 0) {
        alert('Please add at least one option to create the poll.');
        return;
    }

    createPoll(pollOptions);
}

// Function to create a poll
function createPoll(options) {
    pollData = {
        options: pollOptions,
        votes: Array(pollOptions.length).fill(0) // Initialize votes count for each option
    };
    

    if (peer) {
        conn = peer.connect(room_id);
        conn.send(JSON.stringify({ type: 'poll', data: pollData }));
        console.log("Data Send Done");
    } else {
        console.error('Peer object is not available.');
    }
}
// Function to display poll options
function displayPoll(data) {
    const pollContainer = document.getElementById('poll-container');
    pollContainer.innerHTML = ''; // Clear previous poll options

    data.options.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.classList.add('poll-option');
        optionElement.textContent = option;
        optionElement.onclick = () => vote(index);
        pollContainer.appendChild(optionElement);
    });

    // Show poll container
    pollContainer.style.display = 'block';

    // Hide poll results container
    document.getElementById('poll-results').style.display = 'none';
}

// Function to display poll results
function displayPollResults(data) {
    const pollResultsContainer = document.getElementById('poll-results');
    pollResultsContainer.innerHTML = ''; // Clear previous poll results

    const totalVotes = data.votes.reduce((total, votes) => total + votes, 0);
    data.options.forEach((option, index) => {
        const resultElement = document.createElement('div');
        const percentage = totalVotes === 0 ? 0 : (data.votes[index] / totalVotes) * 100;
        resultElement.textContent = `${option}: ${data.votes[index]} votes (${percentage.toFixed(2)}%)`;
        pollResultsContainer.appendChild(resultElement);
    });

    // Show poll results container
    pollResultsContainer.style.display = 'block';

    // Hide poll container
    document.getElementById('poll-container').style.display = 'none';
}
// Assuming you have a peer object set up and listening for data

	conn.on('data', function(data) {
	  console.log('Received', data);
      const parsedData = JSON.parse(data);
      if (parsedData.type === 'poll') {
        // Call displayPoll to show the poll options
        displayPoll(parsedData.data);
    }
    });