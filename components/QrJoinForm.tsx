"use client";

import { useRef, useState, useEffect } from "react";
import jsQR from "jsqr";
import { SubmitButton } from "./SubmitButton";
import { OwnerField } from "@/components/OwnerField";
import { joinGymByCodeAction } from "@/app/u/actions";

/**
 * 選手・会員が「カメラでジムのQRを読み取って参加する」フォーム。
 * QRは /register?gym=CODE のURL or 生コード。読めない環境ではコード手入力でも参加できる。
 */
export function QrJoinForm({ currentGymName, ownerId }: { currentGymName?: string; ownerId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  };
  useEffect(() => stop, []);

  const start = async () => {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      setScanning(true);
      const tick = () => {
        const v2 = videoRef.current, c = canvasRef.current;
        if (v2 && c && v2.readyState >= 2 && v2.videoWidth) {
          c.width = v2.videoWidth;
          c.height = v2.videoHeight;
          const ctx = c.getContext("2d")!;
          ctx.drawImage(v2, 0, 0, c.width, c.height);
          const img = ctx.getImageData(0, 0, c.width, c.height);
          const r = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (r?.data) {
            let val = r.data.trim();
            const m = val.match(/[?&]gym=([^&\s]+)/i);
            if (m) val = decodeURIComponent(m[1]);
            setCode(val.toUpperCase());
            stop();
            return;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setErr("カメラを起動できませんでした。ブラウザのカメラ許可を確認するか、下にコードを手入力してください。");
      setScanning(false);
    }
  };

  return (
    <div className="card">
      {currentGymName && <p className="meta mt0">現在の所属：<b>{currentGymName}</b></p>}

      {!scanning && (
        <button type="button" className="btn btn-primary" onClick={start}>📷 カメラでQRを読み取る</button>
      )}
      {scanning && (
        <>
          <video ref={videoRef} playsInline muted style={{ width: "100%", borderRadius: 12, background: "#000", marginTop: 8 }} />
          <button type="button" className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 8 }} onClick={stop}>読み取りをやめる</button>
        </>
      )}
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {code && <div className="alert-band alert-green" style={{ marginTop: 8 }}>読み取りました：<b>{code}</b>（下のボタンで参加）</div>}
      {err && <div className="field-error">{err}</div>}

      <form action={joinGymByCodeAction} style={{ marginTop: 10 }}>
        <OwnerField id={ownerId} />
        <label className="fl">チームコード（手入力もOK）</label>
        <input name="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="例: FIGHTBASE" style={{ textTransform: "uppercase" }} required />
        <div style={{ height: 10 }} />
        <SubmitButton className="btn btn-accent" pendingLabel="参加しています…">このコードのジムに参加する</SubmitButton>
      </form>
      <p className="info-note" style={{ marginBottom: 0 }}>
        QRを読み取るか、ジムから配られたコードを入力してください。参加すると、あなたの記録がそのジムのスタッフに共有されます（＝チームで見守られます）。
      </p>
    </div>
  );
}
