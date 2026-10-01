import { useEffect, useRef } from "react";

const MEDIAPIPE_MODULE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";
const MEDIAPIPE_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

// Labels that usually mean "the laptop's own camera".
// If your built-in camera has a different name, add it here.
const BUILT_IN_CAMERA = /integrated|built-?in|internal|facetime|laptop|front|user/i;
const REAR_CAMERA = /back|rear|environment/i;

const VIDEO_CONSTRAINTS = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 15, max: 24 },
};

async function getExternalCameraStream() {
  try {
    const temp = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    temp.getTracks().forEach((track) => track.stop());
  } catch (error) {
    console.warn("ATLAS: permission probe failed", error);
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((device) => device.kind === "videoinput");
  console.log("ATLAS CAMERAS:", cameras.map((c) => c.label || "(no label)"));

  const chosen =
    cameras.find((c) => /^hd camera/i.test(c.label)) ||
    cameras.find((c) => !BUILT_IN_CAMERA.test(c.label)) ||
    cameras[cameras.length - 1];

  if (chosen) {
    const attempts = [
      { deviceId: { exact: chosen.deviceId }, width: { ideal: 640 }, height: { ideal: 480 } },
      { deviceId: { exact: chosen.deviceId } },
    ];
    for (const video of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
        console.log("ATLAS USING CAMERA:", chosen.label);
        return stream;
      } catch (error) {
        console.warn("ATLAS: camera attempt failed:", error.name, error.message);
      }
    }
  }

  return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
}

export function usePersonPresence(enabled, videoRef, callbacks = {}) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!enabled) return undefined;

    let disposed = false;
    let stream = null;
    let video = null;
    let detector = null;
    let scanTimer = null;
    let inferenceRunning = false;
    let detectionComplete = false;
    let presentSince = null;
    let lastPresenceState = false;

    const stopCamera = () => {
      if (scanTimer) clearInterval(scanTimer);
      scanTimer = null;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      try {
        detector?.close?.();
      } catch {
        // The detector may already have been disposed.
      }
      detector = null;
    };

    const fail = (error) => {
      if (disposed) return;
      stopCamera();
      callbacksRef.current.onUnavailable?.(error);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access requires a supported secure browser.");
      }

      callbacksRef.current.onStatus?.("ALLOW CAMERA ACCESS TO BEGIN");
      stream = await getExternalCameraStream();
      if (disposed) {
        stopCamera();
        return;
      }

      video = videoRef?.current || document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      if (disposed) {
        stopCamera();
        return;
      }
      callbacksRef.current.onCameraReady?.();

      callbacksRef.current.onStatus?.("LOOKING FOR A PERSON");
      const vision = await import(/* @vite-ignore */ MEDIAPIPE_MODULE);
      if (disposed) {
        stopCamera();
        return;
      }

      const files = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
      detector = await vision.FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: FACE_MODEL },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.65,
        minSuppressionThreshold: 0.3,
      });
      if (disposed) {
        stopCamera();
        return;
      }

      scanTimer = setInterval(() => {
        if (
          disposed ||
          detectionComplete ||
          inferenceRunning ||
          !detector ||
          !video ||
          video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
        ) return;

        inferenceRunning = true;
        try {
          const detections = detector.detectForVideo(video, performance.now()).detections || [];
          const faceVisible = detections.some(
            (detection) => (detection.categories?.[0]?.score || 0) >= 0.65,
          );
          const now = performance.now();

          if (faceVisible) {
            presentSince ??= now;
            if (!lastPresenceState) {
              lastPresenceState = true;
              callbacksRef.current.onStatus?.("PERSON DETECTED — HOLD FOR 3 SECONDS");
            }
            if (now - presentSince >= 3000) {
              detectionComplete = true;
              clearInterval(scanTimer);
              scanTimer = null;
              try {
                detector?.close?.();
              } catch {
                // The detector may already have been disposed.
              }
              detector = null;
              callbacksRef.current.onDetected?.();
            }
          } else {
            presentSince = null;
            if (lastPresenceState) {
              lastPresenceState = false;
              callbacksRef.current.onStatus?.("LOOKING FOR A PERSON");
            }
          }
        } catch (error) {
          fail(error);
        } finally {
          inferenceRunning = false;
        }
      }, 400);
    };

    start().catch(fail);
    return () => {
      disposed = true;
      stopCamera();
    };
  }, [enabled, videoRef]);
}