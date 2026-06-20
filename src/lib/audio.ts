"use client";

class AudioManager {
  // ── 默认环境音量与事件配置（可以在此处修改数值进行微调） ──
  public readonly AMBIENT_CONFIG = {
    // 1. 基础环境底噪音量 (提示：由于真实 WAV/MP3 循环音轨录音音量通常比合成白噪小很多，如果听不到，可调高到 0.1 ~ 0.5 之间)
    spaceDrone: 0.08,         // 星空宇宙底噪音量
    waterMicro: 0.05,         // 水面微波/水流循环音轨音量 (如果您觉得底噪太低/听不到，可以调大到 0.3 左右；如果觉得太吵，可以调小到 0.02 左右)
    waterCampfire: 0.0001,      // 水面下的微弱噼啪底噪音量
    campfireRumble: 0.05,     // 篝火低频燃烧循环音轨音量 (如果您觉得底噪太低/听不到，可以调大到 0.4 左右；如果觉得太吵，可以调小到 0.03 左右)
    campfireCrackle: 0.0001,    // 篝火高频噼啪底噪音量

    // 2. 随机自然音效事件音量和触发间隔
    waterEventVolume: 0.20,   // 水面随机风声/鸟鸣事件音量
    waterEventMinInterval: 12000, // 水面随机事件最小间隔 (毫秒)
    waterEventMaxInterval: 24000, // 水面随机事件最大间隔 (毫秒)

    campfirePopVolume: 0.20,  // 篝火随机柴火爆裂事件音量
    campfirePopMinInterval: 2000,  // 篝火随机爆裂最小间隔 (毫秒)
    campfirePopMaxInterval: 5000,  // 篝火随机爆裂最大间隔 (毫秒)
  };

  private ctx: AudioContext | null = null;
  public isMuted: boolean = true; // 默认静音
  public themeIdx: number = 0;

  // 节点管理
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  // 采样音频 Buffer 和加载状态
  private waterLoopBuffer: AudioBuffer | null = null;
  private fireLoopBuffer: AudioBuffer | null = null;
  private isWaterLoading: boolean = false;
  private isFireLoading: boolean = false;

  // 音阶定义 (五声音阶)
  private readonly SCALES = {
    // 星空 (Space): 高频、灵动 (C5-C6)
    0: [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51],
    // 水面 (Water): 中高频、清脆 (C4-C5)
    1: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25],
    // 篝火 (Campfire): 中低频、温暖 (C3-C4)
    2: [130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66, 329.63]
  };

  // 星空环境音
  private spaceDroneOsc1: OscillatorNode | null = null;
  private spaceDroneOsc2: OscillatorNode | null = null;
  private spaceDroneGain: GainNode | null = null;

  // 水面环境音
  private waterNoiseSrc: AudioBufferSourceNode | null = null;
  private waterNoiseGain: GainNode | null = null;
  private fireNoiseSrc: AudioBufferSourceNode | null = null;
  private fireNoiseGain: GainNode | null = null;

  // 篝火环境音
  private campfireRumbleSrc: AudioBufferSourceNode | null = null;
  private campfireRumbleGain: GainNode | null = null;
  private campfireCrackleSrc: AudioBufferSourceNode | null = null;
  private campfireCrackleGain: GainNode | null = null;

  // 混响
  private convolver: ConvolverNode | null = null;

  private ambientIntervals: number[] = [];
  private getFrequency(postId: string | number | undefined, themeIdx: number): number {
    const scale = this.SCALES[themeIdx as keyof typeof this.SCALES] || this.SCALES[1];
    if (postId === undefined) return scale[Math.floor(Math.random() * scale.length)];
    const idNum = typeof postId === 'string' ? 
      postId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 
      Number(postId);
    return scale[idNum % scale.length];
  }


  // 生成房间/洞穴混响的冲激响应
  private createImpulseResponse(
    ctx: AudioContext,
    duration: number,
    decay: number,
  ) {
    const length = ctx.sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
      left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return impulse;
  }

  // 生成白噪声
  private createNoiseBuffer(ctx: AudioContext, duration: number = 2) {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
  private async loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    try {
      console.log(`[AudioManager] Fetching audio from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      console.log(`[AudioManager] Decoding audio data for: ${url}`);
      const buffer = await this.ctx.decodeAudioData(arrayBuffer);
      console.log(`[AudioManager] Successfully loaded and decoded: ${url}`);
      return buffer;
    } catch (e) {
      console.error("[AudioManager] Failed to load audio buffer from:", url, e);
      return null;
    }
  }

  private async preloadLoops() {
    if (!this.ctx) return;
    if (!this.waterLoopBuffer && !this.isWaterLoading) {
      this.isWaterLoading = true;
      this.loadAudioBuffer("/audio/water_loop.wav").then((buf) => {
        this.waterLoopBuffer = buf;
        this.isWaterLoading = false;
        console.log("[AudioManager] Water loop loaded. themeIdx:", this.themeIdx, "isMuted:", this.isMuted);
        if (this.themeIdx === 1 && !this.isMuted) {
          console.log("[AudioManager] Triggering updateAmbient() for water theme after load");
          this.updateAmbient();
        }
      });
    }
    if (!this.fireLoopBuffer && !this.isFireLoading) {
      this.isFireLoading = true;
      this.loadAudioBuffer("/audio/fire_loop.mp3").then((buf) => {
        this.fireLoopBuffer = buf;
        this.isFireLoading = false;
        console.log("[AudioManager] Fire loop loaded. themeIdx:", this.themeIdx, "isMuted:", this.isMuted);
        if (this.themeIdx === 2 && !this.isMuted) {
          console.log("[AudioManager] Triggering updateAmbient() for campfire theme after load");
          this.updateAmbient();
        }
      });
    }
  }


  // 生成粉噪音 (Paul Kellet algorithm, -3dB/octave)
  private createPinkNoiseBuffer(ctx: AudioContext, duration: number = 3) {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  init() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();

        // 主音量
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);

        // 环境音量
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.connect(this.masterGain);

        // 混响节点
        this.convolver = this.ctx.createConvolver();
        this.convolver.buffer = this.createImpulseResponse(this.ctx, 3.0, 2.0);
        this.convolver.connect(this.masterGain);

        // 异步预加载 WAV/MP3 循环音频与分段序列
        this.preloadLoops();
        this.loadSequence("/audio/water_lofi.mp3");
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : 1,
        this.ctx.currentTime,
        0.1,
      );
    }
    if (!this.isMuted) {
      this.init();
      this.updateAmbient();
    } else {
      this.stopAmbient();
    }
    return this.isMuted;
  }

  setTheme(themeIdx: number) {
    this.themeIdx = themeIdx;
    if (!this.isMuted) {
      this.updateAmbient();
    }
  }

  private stopAmbient() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 捕获当前声源引用，防止 updateAmbient 覆盖后误停新声源
    const oldSpaceOsc1 = this.spaceDroneOsc1;
    const oldSpaceOsc2 = this.spaceDroneOsc2;
    const oldWaterSrc = this.waterNoiseSrc;
    const oldFireSrc = this.fireNoiseSrc;
    const oldCampfireRumbleSrc = this.campfireRumbleSrc;
    const oldCampfireCrackleSrc = this.campfireCrackleSrc;

    if (this.spaceDroneGain) {
      this.spaceDroneGain.gain.setTargetAtTime(0, now, 1);
      setTimeout(() => {
        oldSpaceOsc1?.stop();
        oldSpaceOsc1?.disconnect();
        oldSpaceOsc2?.stop();
        oldSpaceOsc2?.disconnect();
      }, 2000);
    }
    if (this.waterNoiseGain) {
      this.waterNoiseGain.gain.setTargetAtTime(0, now, 1);
      setTimeout(() => {
        oldWaterSrc?.stop();
        oldWaterSrc?.disconnect();
      }, 2000);
    }
    if (this.fireNoiseGain) {
      this.fireNoiseGain.gain.setTargetAtTime(0, now, 1);
      setTimeout(() => {
        oldFireSrc?.stop();
        oldFireSrc?.disconnect();
      }, 2000);
    }
    if (this.campfireRumbleGain) {
      this.campfireRumbleGain.gain.setTargetAtTime(0, now, 1);
      setTimeout(() => {
        oldCampfireRumbleSrc?.stop();
        oldCampfireRumbleSrc?.disconnect();
      }, 2000);
    }
    if (this.campfireCrackleGain) {
      this.campfireCrackleGain.gain.setTargetAtTime(0, now, 1);
      setTimeout(() => {
        oldCampfireCrackleSrc?.stop();
        oldCampfireCrackleSrc?.disconnect();
      }, 2000);
    }

    this.ambientIntervals.forEach((id) => clearInterval(id));
    this.ambientIntervals = [];
  }

  private updateAmbient() {
    if (this.isMuted || !this.ctx || !this.ambientGain) return;
    this.stopAmbient();
    const now = this.ctx.currentTime;

    if (this.themeIdx === 0) {
      // ── 星空主题 (Space) ──
      // 1. 宇宙底噪 (Drone) 60-80Hz
      this.spaceDroneGain = this.ctx.createGain();
      this.spaceDroneGain.gain.setValueAtTime(0, now);
      this.spaceDroneGain.gain.setTargetAtTime(this.AMBIENT_CONFIG.spaceDrone, now, 3); // 极低音量
      this.spaceDroneGain.connect(this.convolver!); // 增加空间感
      this.spaceDroneGain.connect(this.ambientGain);

      this.spaceDroneOsc1 = this.ctx.createOscillator();
      this.spaceDroneOsc1.type = "sine";
      this.spaceDroneOsc1.frequency.value = 65;
      this.spaceDroneOsc1.connect(this.spaceDroneGain);
      this.spaceDroneOsc1.start();

      this.spaceDroneOsc2 = this.ctx.createOscillator();
      this.spaceDroneOsc2.type = "triangle";
      this.spaceDroneOsc2.frequency.value = 68; // 微微的频响拍音
      this.spaceDroneOsc2.connect(this.spaceDroneGain);
      this.spaceDroneOsc2.start();

      // 2. 稀疏的高频结晶音 (Crystalline shimmer)
      const playCrystal = () => {
        if (this.isMuted || this.themeIdx !== 0 || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(
          2000 + Math.random() * 2000,
          this.ctx.currentTime,
        ); // 2000-4000Hz

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          this.ctx.currentTime + 1.5,
        ); // 持续1-2秒自然衰减

        osc.connect(gain);
        gain.connect(this.convolver!); // 通过混响获得空灵感
        osc.start();
        osc.stop(this.ctx.currentTime + 2);

        // 随机间隔 8~20秒
        const nextInterval = 8000 + Math.random() * 12000;
        this.ambientIntervals.push(
          window.setTimeout(playCrystal, nextInterval),
        );
      };
      playCrystal();
    } else if (this.themeIdx === 1) {
      // ── 水面主题 (Water) ──
      // 1. 水面微波声 (Filtered Noise)
      this.waterNoiseGain = this.ctx.createGain();
      this.waterNoiseGain.gain.setValueAtTime(0, now);
      this.waterNoiseGain.gain.setTargetAtTime(this.AMBIENT_CONFIG.waterMicro, now, 2);

      // 多层滤波：低通 200Hz 去除高频嘶声 + 带通 150Hz 增强低沉水波
      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 200; // 降低截止频率，平滑高频白噪

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 150; // 中心 150Hz，强化水波沉闷感
      bandpass.Q.value = 0.7;

      lowpass.connect(bandpass);
      bandpass.connect(this.waterNoiseGain);
      this.waterNoiseGain.connect(this.ambientGain);

      // LFO 模拟细碎涟漪
      const lfo = this.ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.2;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 80;
      lfo.connect(lfoGain);
      lfoGain.connect(lowpass.frequency);
      lfo.start();

      this.waterNoiseSrc = this.ctx.createBufferSource();
      if (this.waterLoopBuffer) {
        console.log("[AudioManager] Playing loaded water_loop.wav buffer!");
        this.waterNoiseSrc.buffer = this.waterLoopBuffer;
        this.waterNoiseSrc.loop = true;
        this.waterNoiseSrc.connect(this.waterNoiseGain);
      } else {
        console.log("[AudioManager] water_loop.wav not loaded yet, playing synthesized water noise fallback");
        this.waterNoiseSrc.buffer = this.createNoiseBuffer(this.ctx, 5);
        this.waterNoiseSrc.loop = true;
        this.waterNoiseSrc.connect(lowpass);
      }
      this.waterNoiseSrc.start();

      // 2. 极轻的火焰噼啪声 (Campfire crackle)
      this.fireNoiseGain = this.ctx.createGain();
      this.fireNoiseGain.gain.setValueAtTime(0, now);
      this.fireNoiseGain.gain.setTargetAtTime(this.AMBIENT_CONFIG.waterCampfire, now, 2);

      const fireFilter = this.ctx.createBiquadFilter();
      fireFilter.type = "bandpass";
      fireFilter.frequency.value = 6000;
      fireFilter.Q.value = 1.5;
      fireFilter.connect(this.fireNoiseGain);
      this.fireNoiseGain.connect(this.ambientGain);

      this.fireNoiseSrc = this.ctx.createBufferSource();
      this.fireNoiseSrc.buffer = this.createNoiseBuffer(this.ctx, 3);
      this.fireNoiseSrc.loop = true;
      this.fireNoiseSrc.connect(fireFilter);
      this.fireNoiseSrc.start();

      // 3. 远处水鸟/风声 (30-60s 随机触发)
      const playWaterEvent = () => {
        if (this.isMuted || this.themeIdx === 0 || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(
          400 + Math.random() * 200,
          this.ctx.currentTime,
        );
        osc.frequency.exponentialRampToValueAtTime(
          300,
          this.ctx.currentTime + 1,
        );

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(this.AMBIENT_CONFIG.waterEventVolume, this.ctx.currentTime + 0.5);
        gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);

        osc.connect(gain);
        gain.connect(this.convolver!); // 强混响制造纵深感
        osc.start();
        osc.stop(this.ctx.currentTime + 2);

        const nextInterval = this.AMBIENT_CONFIG.waterEventMinInterval + Math.random() * (this.AMBIENT_CONFIG.waterEventMaxInterval - this.AMBIENT_CONFIG.waterEventMinInterval);
        this.ambientIntervals.push(
          window.setTimeout(playWaterEvent, nextInterval),
        );
      };
      playWaterEvent();

      // 午夜时段水声减弱，火焰声略微凸显
      const hour = new Date().getHours();
      if (hour >= 22 || hour < 6) {
        this.waterNoiseGain.gain.setTargetAtTime(this.AMBIENT_CONFIG.waterMicro * 0.6, now, 1);
        this.fireNoiseGain.gain.setTargetAtTime(this.AMBIENT_CONFIG.waterCampfire * 1.5, now, 1);
      }
    } else {
      // ── 篝火主题 (Campfire) ──
      // 1. 烧木头粉噪音底噪 (Burning wood pink noise rumble)
      this.campfireRumbleGain = this.ctx.createGain();
      this.campfireRumbleGain.gain.setValueAtTime(0, now);
      this.campfireRumbleGain.gain.setTargetAtTime(this.AMBIENT_CONFIG.campfireRumble, now, 2);

      const rumbleFilter = this.ctx.createBiquadFilter();
      rumbleFilter.type = "lowpass";
      rumbleFilter.frequency.value = 600; // 低沉木头燃烧声
      rumbleFilter.connect(this.campfireRumbleGain);
      this.campfireRumbleGain.connect(this.ambientGain);

      // LFO 模拟火焰摇曳
      const campfireLfo = this.ctx.createOscillator();
      campfireLfo.type = "sine";
      campfireLfo.frequency.value = 0.2;
      const campfireLfoGain = this.ctx.createGain();
      campfireLfoGain.gain.value = 200;
      campfireLfo.connect(campfireLfoGain);
      campfireLfoGain.connect(rumbleFilter.frequency);
      campfireLfo.start();

      this.campfireRumbleSrc = this.ctx.createBufferSource();
      if (this.fireLoopBuffer) {
        console.log("[AudioManager] Playing loaded fire_loop.mp3 buffer!");
        this.campfireRumbleSrc.buffer = this.fireLoopBuffer;
        this.campfireRumbleSrc.loop = true;
        this.campfireRumbleSrc.connect(this.campfireRumbleGain);
      } else {
        console.log("[AudioManager] fire_loop.mp3 not loaded yet, playing synthesized campfire pink noise fallback");
        this.campfireRumbleSrc.buffer = this.createPinkNoiseBuffer(this.ctx, 3);
        this.campfireRumbleSrc.loop = true;
        this.campfireRumbleSrc.connect(rumbleFilter);
      }
      this.campfireRumbleSrc.start();

      // 2. 高频噼啪声 (Fire crackle, bandpass ~5000Hz) — 增强增益
      this.campfireCrackleGain = this.ctx.createGain();
      this.campfireCrackleGain.gain.setValueAtTime(0, now);
      this.campfireCrackleGain.gain.setTargetAtTime(this.AMBIENT_CONFIG.campfireCrackle, now, 2);

      const crackleFilter = this.ctx.createBiquadFilter();
      crackleFilter.type = "bandpass";
      crackleFilter.frequency.value = 5000;
      crackleFilter.Q.value = 1.5;
      crackleFilter.connect(this.campfireCrackleGain);
      this.campfireCrackleGain.connect(this.ambientGain);

      this.campfireCrackleSrc = this.ctx.createBufferSource();
      this.campfireCrackleSrc.buffer = this.createNoiseBuffer(this.ctx, 2);
      this.campfireCrackleSrc.loop = true;
      this.campfireCrackleSrc.connect(crackleFilter);
      this.campfireCrackleSrc.start();

      // 3. 随机柴火爆裂声 (Subtle crisp snaps, not thumping)
      const playPop = () => {
        if (this.isMuted || this.themeIdx !== 2 || !this.ctx || !this.ambientGain) return;
        
        const now = this.ctx.currentTime;
        const popSrc = this.ctx.createBufferSource();
        // 0.02 - 0.04s short burst
        const duration = 0.02 + Math.random() * 0.02;
        popSrc.buffer = this.createNoiseBuffer(this.ctx, duration);

        const popFilter = this.ctx.createBiquadFilter();
        popFilter.type = "bandpass";
        // High frequency wood snap: 2000Hz - 4500Hz
        popFilter.frequency.setValueAtTime(2000 + Math.random() * 2500, now);
        popFilter.Q.setValueAtTime(8.0, now);

        const popGain = this.ctx.createGain();
        // Lower volume (0.04 - 0.09) for realistic, cozy background snaps
        popGain.gain.setValueAtTime(0.04 + Math.random() * 0.05, now);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        popSrc.connect(popFilter);
        popFilter.connect(popGain);
        popGain.connect(this.convolver!); // Soft space reflection
        popGain.connect(this.ambientGain);

        popSrc.start(now);
        popSrc.stop(now + duration + 0.05);

        const nextInterval = this.AMBIENT_CONFIG.campfirePopMinInterval + Math.random() * (this.AMBIENT_CONFIG.campfirePopMaxInterval - this.AMBIENT_CONFIG.campfirePopMinInterval);
        this.ambientIntervals.push(
          window.setTimeout(playPop, nextInterval),
        );
      };
      playPop();
    }
  }

  // ── 交互音效 ──

  playHover(postId?: string | number) {
    this.init();
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freq = this.getFrequency(postId, this.themeIdx);

    if (this.themeIdx === 0) {
      // 星空悬浮：灵动钟琴音
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5); 
      osc.connect(gain);
      gain.connect(this.convolver!);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(now + 0.5);
    } else if (this.themeIdx === 2) {
      // 篝火悬浮：黄昏丛林风声与温暖声学和弦 (Jungle at Dusk - Breeze & Warm Triad)
      // 1. 温暖的黄昏和弦 (Warm major triad chord: root + major 3rd + fifth)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const osc3 = this.ctx.createOscillator();
      const gChord = this.ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc3.type = "sine";

      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * 1.25, now); // major 3rd (warm, harmonious)
      osc3.frequency.setValueAtTime(freq * 1.5, now);  // perfect 5th (open, peaceful)

      gChord.gain.setValueAtTime(0, now);
      gChord.gain.linearRampToValueAtTime(0.03, now + 0.05); // 50ms soft attack to simulate a gentle pluck
      gChord.gain.exponentialRampToValueAtTime(0.001, now + 1.2); // 1.2s long, spacious decay

      osc1.connect(gChord);
      osc2.connect(gChord);
      osc3.connect(gChord);
      gChord.connect(this.convolver!); // Send to convolver reverb for deep forest space reflection
      gChord.connect(this.masterGain);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);
      osc1.stop(now + 1.3);
      osc2.stop(now + 1.3);
      osc3.stop(now + 1.3);

      // 2. 黄昏晚风拂叶声 (Soft evening breeze rustle)
      const breeze = this.ctx.createBufferSource();
      const breezeDuration = 0.6; // 600ms
      breeze.buffer = this.createNoiseBuffer(this.ctx, breezeDuration);

      const breezeFilter = this.ctx.createBiquadFilter();
      breezeFilter.type = "bandpass";
      breezeFilter.frequency.setValueAtTime(1500, now); // soft mid-high forest frequency
      breezeFilter.Q.setValueAtTime(1.0, now); // wide band for a soft whisper

      const gBreeze = this.ctx.createGain();
      gBreeze.gain.setValueAtTime(0, now);
      gBreeze.gain.linearRampToValueAtTime(0.015, now + 0.15); // slow swell like wind rising
      gBreeze.gain.exponentialRampToValueAtTime(0.001, now + breezeDuration);

      breeze.connect(breezeFilter);
      breezeFilter.connect(gBreeze);
      gBreeze.connect(this.convolver!); // wash in reverb
      gBreeze.connect(this.masterGain);

      breeze.start(now);
      breeze.stop(now + breezeDuration);
    } else {
      // 水面悬浮：圆润水滴音
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(this.convolver!);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(now + 0.6);
    }
  }

  playClick(postId?: string | number) {
    this.init();
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freq = this.getFrequency(postId, this.themeIdx);

    if (this.themeIdx === 0 || this.themeIdx === 2) {
      // 宇宙隧道穿梭：低频深邃的星际穿越膨胀音 + 高频扫频合成器 (Interstellar Warp Swell)
      const duration = 2.4; // 持续2.4秒，刚好覆盖到开卡片的2.3s
      const isCampfire = this.themeIdx === 2;

      // 1. 深沉底噪加速/膨胀 (Sub-bass rumble sweep)
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = isCampfire ? "triangle" : "sine";
      // 频率从 55Hz 缓慢升到 75Hz/85Hz (空间拉扯感)
      subOsc.frequency.setValueAtTime(55, now);
      subOsc.frequency.linearRampToValueAtTime(isCampfire ? 65 : 85, now + duration);

      subGain.gain.setValueAtTime(0, now);
      subGain.gain.linearRampToValueAtTime(isCampfire ? 0.18 : 0.12, now + 0.5); // 快速起音
      subGain.gain.setValueAtTime(isCampfire ? 0.18 : 0.12, now + duration - 0.4);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + duration); // 结尾淡出

      subOsc.connect(subGain);
      subGain.connect(this.masterGain);
      subOsc.start(now);
      subOsc.stop(now + duration + 0.1);

      // 2. 扫频声学滤波器 (High-frequency Resonant BP filter sweep)
      // 用带通滤波器处理白噪/锯齿波，模拟气流或星云掠过的啸叫声
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(this.ctx, duration);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = isCampfire ? 3.0 : 5.0; // 越小声音越宽，越大谐振越强
      // 频率从 320Hz 向上扫频
      filter.frequency.setValueAtTime(320, now);
      filter.frequency.exponentialRampToValueAtTime(isCampfire ? 900 : 1600, now + duration - 0.3);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.07, now + 0.4); // 模拟逐渐加速掠过
      noiseGain.gain.setValueAtTime(0.07, now + duration - 0.5);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.convolver!); // 通过混响烘托浩瀚感
      noiseGain.connect(this.masterGain);
      
      noise.start(now);
      noise.stop(now + duration + 0.1);

      // 3. 高空掠过的正弦啸叫 (Space Whistle / Shimmer)
      const whistleOsc = this.ctx.createOscillator();
      const whistleGain = this.ctx.createGain();
      whistleOsc.type = "sine";
      whistleOsc.frequency.setValueAtTime(freq * 1.5, now);
      whistleOsc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + duration);

      whistleGain.gain.setValueAtTime(0, now);
      whistleGain.gain.linearRampToValueAtTime(0.03, now + 0.2);
      whistleGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      whistleOsc.connect(whistleGain);
      whistleGain.connect(this.convolver!);
      whistleGain.connect(this.masterGain);

      whistleOsc.start(now);
      whistleOsc.stop(now + duration);
    } else {
      // 水面进入：连续水滴声 (急促 → 平稳 线性递减)
      const duration = 2.3;
      const baseFreq = freq * 0.8;
      
      let t = 0;
      const intervalStart = 0.06; // 起始间隔：60ms (急促)
      const intervalEnd = 0.45;   // 结束间隔：450ms (平稳)
      let currentInterval = intervalStart;

      while (t < duration) {
        const timeOffset = now + t;
        
        // 每一个水滴使用独立的振荡器与增益节点
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = "sine";
        // 微微的随机频率偏置，使水滴听起来极其真实、不机械
        const dripFreq = baseFreq * (0.93 + Math.random() * 0.14);
        osc.frequency.setValueAtTime(dripFreq, timeOffset);
        // 水滴特有的向下 pitch 扫频 (模拟水珠落入空洞的声调变化)
        osc.frequency.exponentialRampToValueAtTime(dripFreq * 0.45, timeOffset + 0.18);

        gain.gain.setValueAtTime(0, timeOffset);
        gain.gain.linearRampToValueAtTime(0.06, timeOffset + 0.008); // 快速起音
        gain.gain.exponentialRampToValueAtTime(0.001, timeOffset + 0.18); // 快速衰减

        osc.connect(gain);
        gain.connect(this.convolver!); // 通过混响获得深水洞穴的回响感
        gain.connect(this.masterGain);
        
        osc.start(timeOffset);
        osc.stop(timeOffset + 0.22);

        // 递增当前间隔，使得下一次水滴触发时间变长 (水滴下落变平缓)
        const progress = t / duration;
        currentInterval = intervalStart + (intervalEnd - intervalStart) * progress;
        t += currentInterval;
      }

      // 4. 背景添加一个轻微的大水波涟漪作为底噪包络 (Deep swell ripple)
      const swellOsc = this.ctx.createOscillator();
      const swellGain = this.ctx.createGain();
      swellOsc.type = "sine";
      swellOsc.frequency.setValueAtTime(baseFreq * 0.5, now);
      swellOsc.frequency.linearRampToValueAtTime(baseFreq * 0.25, now + duration);

      swellGain.gain.setValueAtTime(0, now);
      swellGain.gain.linearRampToValueAtTime(0.06, now + 0.3);
      swellGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      swellOsc.connect(swellGain);
      swellGain.connect(this.masterGain);
      swellOsc.start(now);
      swellOsc.stop(now + duration);
    }
  }

  playCloseReading() {
    this.init();
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (this.themeIdx === 2) {
      // 篝火返回：火焰声短暂加大再回落
      if (this.campfireRumbleGain) {
        this.campfireRumbleGain.gain.setTargetAtTime(0.14, now, 0.2);
        this.campfireRumbleGain.gain.setTargetAtTime(this.AMBIENT_CONFIG.campfireRumble, now + 0.3, 0.5);
      }
      if (this.campfireCrackleGain) {
        this.campfireCrackleGain.gain.setTargetAtTime(0.06, now, 0.2);
        this.campfireCrackleGain.gain.setTargetAtTime(this.AMBIENT_CONFIG.campfireCrackle, now + 0.3, 0.5);
      }
    } else if (this.themeIdx === 1) {
      // 水面「退潮」：波浪涌起 + 细碎水泡退去
      if (this.waterNoiseGain) {
        this.waterNoiseGain.gain.setTargetAtTime(0.18, now, 0.08);
        this.waterNoiseGain.gain.setTargetAtTime(this.AMBIENT_CONFIG.waterMicro, now + 0.3, 0.4);
      }
      if (this.fireNoiseGain) {
        this.fireNoiseGain.gain.setTargetAtTime(this.AMBIENT_CONFIG.waterCampfire, now, 0.5);
      }
      // 水泡声：3-4 个短促音从 600Hz 滑到 250Hz
      for (let i = 0; i < 4; i++) {
        const tOff = 0.12 + i * 0.12;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        const baseFreq = 600 - i * 90;
        osc.frequency.setValueAtTime(baseFreq, now + tOff);
        osc.frequency.exponentialRampToValueAtTime(250, now + tOff + 0.18);
        g.gain.setValueAtTime(0, now + tOff);
        g.gain.linearRampToValueAtTime(0.035, now + tOff + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + tOff + 0.25);
        osc.connect(g);
        g.connect(this.convolver!);
        g.connect(this.masterGain!);
        osc.start(now + tOff);
        osc.stop(now + tOff + 0.3);
      }
    } else {
      // 星空「坠入虚空」：晶莹双音滑入深渊
      if (this.spaceDroneGain) {
        this.spaceDroneGain.gain.setTargetAtTime(this.AMBIENT_CONFIG.spaceDrone * 2, now, 0.1);
        this.spaceDroneGain.gain.setTargetAtTime(this.AMBIENT_CONFIG.spaceDrone, now + 0.6, 0.6);
      }
      // 双振荡器：高音 shimmer 下滑
      [1, 1.5].forEach((ratio) => {
        const osc = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        osc.type = "sine";
        const startFreq = 2400 * ratio;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(startFreq * 0.25, now + 0.8);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.05, now + 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        osc.connect(g);
        g.connect(this.convolver!);
        g.connect(this.masterGain!);
        osc.start(now);
        osc.stop(now + 1.0);
      });
    }
  }

  playSend() {
    this.init();
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (this.themeIdx === 0) {
      // 星空发帖：点亮星星的钟琴单音 C5(523.25) 或 E5(659.25)，0.4s
      const freq = Math.random() > 0.5 ? 523.25 : 659.25;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(this.convolver!);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(now + 0.4);
    } else if (this.themeIdx === 2) {
      // 篝火发帖：木柴投入火中，短暂火焰高涨声 (0.5s)
      if (this.campfireCrackleGain) {
        this.campfireCrackleGain.gain.setTargetAtTime(0.08, now, 0.1);
        this.campfireCrackleGain.gain.setTargetAtTime(this.AMBIENT_CONFIG.campfireCrackle, now + 0.3, 0.5);
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(250, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(this.convolver!);
      osc.start();
      osc.stop(now + 0.5);
    } else {
      // 水面发帖：浮灯入水轻微水声 + 扑声 (0.6s)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.2); // 扑声
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(this.masterGain);

      // 水声白噪音
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(this.ctx, 0.3);
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 800;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.1, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      osc.start();
      osc.stop(now + 0.6);
      noise.start();
      noise.stop(now + 0.3);
    }
  }

  playThemeToggle() {
    this.init();
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const ctx = this.ctx;

    if (this.themeIdx === 0) {
      // 星空：C5-E5-G5 大三和弦琶音 (水晶般明亮)
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.05, now + i * 0.12 + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);
        osc.connect(gain);
        gain.connect(this.convolver!);
        gain.connect(this.masterGain!);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.5);
      });
    } else if (this.themeIdx === 1) {
      // 水面：D3 → A2 轻柔下行，模拟水波沉入
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(147, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.6);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(gain);
      gain.connect(this.convolver!);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(now + 0.8);
    } else {
      // 篝火：火焰爆裂 — 噪音 burst + C4-E4-G4 中频和弦（确保所有扬声器可听）
      // 1. 噪音频闪（模拟柴火爆裂）
      const noise = ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(ctx, 0.15);
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(3000, now);
      noiseFilter.Q.setValueAtTime(3, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.1, now + 0.02);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain!);
      noise.start(now);
      noise.stop(now + 0.15);

      // 2. 温暖中频和弦 C4-E4-G4
      [262, 330, 392].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.08, now + i * 0.08 + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.5);
        osc.connect(gain);
        gain.connect(this.convolver!);
        gain.connect(this.masterGain!);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.6);
      });
    }
  }

  playMeToo() {
    this.init();
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (this.themeIdx === 0) {
      // 星空MeToo：极轻星尘飘散，多颗小音符 (0.5s，音量低40%)
      const ctx = this.ctx;
      [0, 0.15, 0.25].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1200 + i * 300, now + delay);
        gain.gain.setValueAtTime(0.02, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.2);
        osc.connect(gain);
        gain.connect(this.convolver!);
        osc.start(now + delay);
        osc.stop(now + delay + 0.2);
      });
    } else if (this.themeIdx === 2) {
      // 篝火MeToo：轻微柴火爆裂 (0.3s)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(150 + Math.random() * 100, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(this.convolver!);
      osc.start();
      osc.stop(now + 0.3);
    } else {
      // 水面MeToo：水面荡漾 ripple，像投入石子 (0.5s)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(now + 0.5);
    }
  }

  playUnmetoo() {
    this.init();
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (this.themeIdx === 0) {
      // 星空Unmetoo：下行音调 (0.4s)
      const ctx = this.ctx;
      [0, 0.12].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(900 - i * 200, now + delay);
        gain.gain.setValueAtTime(0.015, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
        osc.connect(gain);
        gain.connect(this.convolver!);
        osc.start(now + delay);
        osc.stop(now + delay + 0.15);
      });
    } else if (this.themeIdx === 2) {
      // 篝火Unmetoo：更轻微的爆裂/消退声
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.convolver!);
      osc.start();
      osc.stop(now + 0.25);
    } else {
      // 水面Unmetoo：低沉一点的水泡声
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(now + 0.4);
    }
  }

  // 情绪点缀音 (长停留触发)
  playLongStayEvent() {
    this.init();
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (this.themeIdx === 0) {
      // 星空长时间停留：极轻柔弦乐单音渐入渐出 (10s)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle"; // 近似弦乐
      osc.frequency.setValueAtTime(440, now); // A4

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.03, now + 4); // 音量极轻
      gain.gain.linearRampToValueAtTime(0, now + 10);

      osc.connect(gain);
      gain.connect(this.convolver!);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(now + 10);
    } else if (this.themeIdx === 2) {
      // 篝火长时间停留：火焰低沉涌动 (8s)
      if (this.campfireRumbleGain) {
        this.campfireRumbleGain.gain.setTargetAtTime(0.12, now, 3);
        this.campfireRumbleGain.gain.setTargetAtTime(this.AMBIENT_CONFIG.campfireRumble, now + 6, 3);
      }
    }
  }

  // ── 音频序列（MP3 分段 + 完整播放）──

  /** 加载 MP3 并切分为 seqTotalSegments 段 */
  async loadSequence(url: string) {
    try {
      if (typeof window === "undefined") return;
      this.init();
      if (!this.ctx) return;
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      this.seqBuffer = await this.ctx.decodeAudioData(buf);
      // 按 0.5s 分段，取整
      this.seqSegmentDuration = 0.5;
      this.seqTotalSegments = Math.max(
        1,
        Math.floor(this.seqBuffer.duration / this.seqSegmentDuration),
      );
      this.seqCurrentIndex = 0;
      this.seqAllPlayed = false;
      this.seqLoaded = true;
    } catch {
      this.seqLoaded = false;
    }
  }

  // ── 音频序列状态 ──
  public seqLoaded: boolean = false;
  public seqFullPlaying: boolean = false;
  public seqHoverCount: number = 0;       // 累计悬停次数（0→5）
  private seqBuffer: AudioBuffer | null = null;
  private seqSegmentDuration: number = 0.5;
  private seqTotalSegments: number = 0;
  private seqCurrentIndex: number = 0;
  private seqAllPlayed: boolean = false;
  private seqFullSource: AudioBufferSourceNode | null = null;
  private seqNextTime: number = 0;

  /** 播放下一个 0.5s 片段（精确时间线调度）。累计 5 次后触发完整播放 */
  playNextSegment(): boolean {
    if (!this.seqBuffer || !this.ctx || this.isMuted) return false;
    if (this.seqFullPlaying) return false;

    this.seqHoverCount++;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    if (this.seqNextTime < now) {
      this.seqNextTime = now + 0.05;
    }

    const idx = this.seqCurrentIndex;
    this.seqCurrentIndex++;

    const bufStart = idx * this.seqSegmentDuration;
    const dur = 0.5;
    const when = this.seqNextTime;
    this.seqNextTime = when + dur + 0.01;

    const src = ctx.createBufferSource();
    src.buffer = this.seqBuffer;

    const gain = ctx.createGain();
    const fade = 0.02;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.55, when + fade);
    gain.gain.setValueAtTime(0.55, when + dur - fade);
    gain.gain.linearRampToValueAtTime(0, when + dur);

    src.connect(gain);
    gain.connect(this.masterGain!);
    src.start(when, bufStart, dur + 0.02);
    src.stop(when + dur + 0.05);

    // 第 5 次悬停 → 当前段播完后从该位置开始完整播放
    if (this.seqHoverCount >= 5) {
      const segmentStartMs = (when - ctx.currentTime) * 1000 + dur + 0.1;
      // 阻止后续悬停产生新片段
      this.seqFullPlaying = true;
      setTimeout(() => {
        this.playFullSequenceFrom(idx * this.seqSegmentDuration);
      }, Math.max(0, segmentStartMs));
      return true;
    }

    return this.seqCurrentIndex >= this.seqTotalSegments;
  }

  /** 从指定秒数开始播放完整 MP3，到结尾后从头循环（1.5s 间隔） */
  private playFullSequenceFrom(startTime: number) {
    if (!this.seqBuffer || !this.ctx || this.isMuted) return;
    this.stopFullSequence();
    this.seqFullPlaying = true;
    this.stopAmbient();

    const totalDur = this.seqBuffer.duration;

    const playOnce = (from: number, to: number) => {
      if (!this.seqBuffer || !this.ctx || this.isMuted) {
        this.seqFullPlaying = false;
        return;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = this.seqBuffer;
      src.connect(this.masterGain!);
      // 播放 [from, to) 段
      src.start(0, from, to - from);
      return src;
    };

    // 第一段：从 startTime 播到结尾
    const first = playOnce(startTime, totalDur);
    if (!first) return;
    this.seqFullSource = first;

    // 第一段结束后 → 从头循环（1.5s 间隔）
    first.onended = () => {
      if (this.isMuted || !this.seqFullPlaying) { this.seqFullPlaying = false; return; }
      const loop = () => {
        if (!this.seqBuffer || !this.ctx || this.isMuted || !this.seqFullPlaying) {
          this.seqFullPlaying = false;
          return;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = this.seqBuffer;
        src.connect(this.masterGain!);
        src.start();
        src.onended = () => {
          if (this.isMuted || !this.seqFullPlaying) { this.seqFullPlaying = false; return; }
          setTimeout(loop, 1500);
        };
        this.seqFullSource = src;
      };
      setTimeout(loop, 1500);
    };
  }

  /** 从开头播放完整 MP3（画圆手势用） */
  playFullSequence() {
    this.playFullSequenceFrom(0);
  }

  /** 停止完整音频循环 */
  stopFullSequence() {
    this.seqFullSource?.stop();
    this.seqFullSource?.disconnect();
    this.seqFullSource = null;
    this.seqFullPlaying = false;
  }

  /** 解锁缓冲区（主题切换 / 静音开关时调用） */
  unlockSequence() {
    this.stopFullSequence();
    this.seqHoverCount = 0;
    this.seqCurrentIndex = 0;
    this.seqAllPlayed = false;
    this.seqNextTime = 0;
  }

  /** 重置序列计数器 */
  resetSequence() {
    this.seqCurrentIndex = 0;
    this.seqAllPlayed = false;
  }
}

// 确保只创建一个实例，默认 isMuted = true 等待用户主动开启
export const audio = new AudioManager();
