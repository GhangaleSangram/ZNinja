async function startSystemAudioCapture() {
  try {
    // 1. Securely fetch available system desktop/window sources via our bridge API
    const sources = await window.electronAPI.getSystemAudioSources();
    
    // 2. Select the entire system screen source (it carries the primary audio loopback)
    const systemSource = sources.find(source => source.id.startsWith('screen:'));
    
    if (!systemSource) {
      throw new Error("No system display audio source detected.");
    }

    // 3. Define constraints. Note: Chromium requires both constraints configured 
    // to successfully hook into system desktop audio, but we will ignore video frames.
    const constraints = {
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: systemSource.id
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: systemSource.id,
          maxWidth: 1,  // Keep video track processing negligible
          maxHeight: 1
        }
      }
    };

    // 4. Request the raw media stream
    const rawDesktopStream = await navigator.mediaDevices.getUserMedia(constraints);

    // 5. Isolate ONLY the audio track
    const audioTracks = rawDesktopStream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error("Failed to find any active system audio streams on this source.");
    }

    // Create a pristine, audio-only MediaStream object
    const finalSystemAudioStream = new MediaStream([audioTracks[0]]);
    console.log("System audio streaming active!");

    // 6. Optional: Route the audio stream to a local Web Audio context to process or log it
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const sourceNode = audioContext.createMediaStreamSource(finalSystemAudioStream);
    
    // To listen live out of your speakers (Caution: can cause feedback loops if microphone is unmuted)
    // sourceNode.connect(audioContext.destination);

    // Return the stream so your transcription engine, speaker processor, or recording API can consume it
    return finalSystemAudioStream;

  } catch (error) {
    console.error("System audio capture sequence failed:", error);
  }
}

// Example binding to a UI element trigger
document.getElementById('capture-audio-btn')?.addEventListener('click', startSystemAudioCapture);
