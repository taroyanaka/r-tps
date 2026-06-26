const AudioCtx = window.AudioContext || window.webkitAudioContext;
        let audioCtx = null;

        function playSFX(type) {
            try {
                if (!audioCtx) {
                    audioCtx = new AudioCtx();
                }
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }

                const now = audioCtx.currentTime;
                
                switch (type) {
                    case 'shoot': {
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(800, now);
                        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
                        gain.gain.setValueAtTime(0.15, now);
                        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
                        osc.connect(gain);
                        gain.connect(audioCtx.destination);
                        osc.start(now);
                        osc.stop(now + 0.15);
                        break;
                    }
                    case 'strike': {
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.type = 'sawtooth';
                        osc.frequency.setValueAtTime(1200, now);
                        osc.frequency.exponentialRampToValueAtTime(300, now + 0.25);
                        gain.gain.setValueAtTime(0.2, now);
                        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
                        osc.connect(gain);
                        gain.connect(audioCtx.destination);
                        osc.start(now);
                        osc.stop(now + 0.25);
                        break;
                    }
                    case 'shotgun': {
                        const bufferSize = audioCtx.sampleRate * 0.15;
                        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                        const data = buffer.getChannelData(0);
                        for (let i = 0; i < bufferSize; i++) {
                            data[i] = Math.random() * 2 - 1;
                        }
                        const noise = audioCtx.createBufferSource();
                        noise.buffer = buffer;
                        const filter = audioCtx.createBiquadFilter();
                        filter.type = 'lowpass';
                        filter.frequency.setValueAtTime(800, now);
                        filter.frequency.exponentialRampToValueAtTime(100, now + 0.15);
                        const gain = audioCtx.createGain();
                        gain.gain.setValueAtTime(0.3, now);
                        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
                        noise.connect(filter);
                        filter.connect(gain);
                        gain.connect(audioCtx.destination);
                        noise.start(now);
                        break;
                    }
                    case 'shield': {
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(200, now);
                        osc.frequency.exponentialRampToValueAtTime(1500, now + 0.3);
                        gain.gain.setValueAtTime(0.2, now);
                        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
                        osc.connect(gain);
                        gain.connect(audioCtx.destination);
                        osc.start(now);
                        osc.stop(now + 0.3);
                        break;
                    }
                    case 'dodge': {
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(600, now);
                        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
                        gain.gain.setValueAtTime(0.15, now);
                        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
                        osc.connect(gain);
                        gain.connect(audioCtx.destination);
                        osc.start(now);
                        osc.stop(now + 0.1);
                        break;
                    }
                    case 'buff': {
                        const osc = audioCtx.createOscillator();
                        const osc2 = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.type = 'sawtooth';
                        osc.frequency.setValueAtTime(300, now);
                        osc.frequency.linearRampToValueAtTime(800, now + 0.5);
                        osc2.type = 'triangle';
                        osc2.frequency.setValueAtTime(305, now);
                        osc2.frequency.linearRampToValueAtTime(805, now + 0.5);
                        gain.gain.setValueAtTime(0.15, now);
                        gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
                        osc.connect(gain);
                        osc2.connect(gain);
                        gain.connect(audioCtx.destination);
                        osc.start(now);
                        osc2.start(now);
                        osc.stop(now + 0.5);
                        osc2.stop(now + 0.5);
                        break;
                    }
                    case 'hit': {
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(120, now);
                        osc.frequency.linearRampToValueAtTime(30, now + 0.1);
                        gain.gain.setValueAtTime(0.2, now);
                        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
                        osc.connect(gain);
                        gain.connect(audioCtx.destination);
                        osc.start(now);
                        osc.stop(now + 0.1);
                        break;
                    }
                    case 'explosion': {
                        const bufferSize = audioCtx.sampleRate * 0.4;
                        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                        const data = buffer.getChannelData(0);
                        for (let i = 0; i < bufferSize; i++) {
                            data[i] = Math.random() * 2 - 1;
                        }
                        const noise = audioCtx.createBufferSource();
                        noise.buffer = buffer;
                        const filter = audioCtx.createBiquadFilter();
                        filter.type = 'lowpass';
                        filter.frequency.setValueAtTime(300, now);
                        filter.frequency.exponentialRampToValueAtTime(20, now + 0.4);
                        const gain = audioCtx.createGain();
                        gain.gain.setValueAtTime(0.4, now);
                        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
                        noise.connect(filter);
                        filter.connect(gain);
                        gain.connect(audioCtx.destination);
                        noise.start(now);
                        break;
                    }
                    case 'draw': {
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(900, now);
                        osc.frequency.setValueAtTime(1200, now + 0.05);
                        gain.gain.setValueAtTime(0.1, now);
                        gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
                        osc.connect(gain);
                        gain.connect(audioCtx.destination);
                        osc.start(now);
                        osc.stop(now + 0.12);
                        break;
                    }
                }
            } catch (e) {
                console.log("Audio contexts pending interaction: ", e);
            }
        }