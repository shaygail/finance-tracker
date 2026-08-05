"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateStockCount } from "@/app/(dashboard)/inventory/actions";
import { ScanLine, Camera, CameraOff } from "lucide-react";

interface QrScannerProps {
  ingredients: Array<{
    id: string;
    name: string;
    qrCode: string;
    currentStock: number;
    unit: string;
  }>;
}

export function QrScanner({ ingredients }: QrScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<(typeof ingredients)[0] | null>(null);
  const [quantity, setQuantity] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = "qr-reader";

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  function findIngredient(code: string) {
    return ingredients.find(
      (i) => i.qrCode === code || i.qrCode.toLowerCase() === code.toLowerCase()
    );
  }

  async function startScanner() {
    setMessage(null);
    const scanner = new Html5Qrcode(readerId);
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const ing = findIngredient(decodedText);
          if (ing) {
            setSelected(ing);
            setQuantity(String(ing.currentStock));
            setMessage(`Scanned: ${ing.name}`);
            stopScanner();
          } else {
            setMessage(`Unknown QR code: ${decodedText}`);
          }
        },
        () => {}
      );
      setScanning(true);
    } catch {
      setMessage("Camera access denied or unavailable");
    }
  }

  async function stopScanner() {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
    }
    setScanning(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    setPending(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("ingredientId", selected.id);
    formData.append("quantity", quantity);

    const result = await updateStockCount(formData);
    setPending(false);

    if (result.error) {
      setMessage(result.error);
    } else {
      setMessage(`Updated ${result.ingredientName} to ${result.quantity} ${selected.unit}`);
      setSelected(null);
      setQuantity("");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-emerald-600" />
            QR Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            id={readerId}
            className={`overflow-hidden rounded-lg ${scanning ? "block" : "hidden"}`}
          />
          {!scanning && (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-slate-300 py-12">
              <Camera className="h-12 w-12 text-slate-400" />
              <p className="text-sm text-slate-500">Point camera at ingredient QR code</p>
            </div>
          )}
          <div className="flex gap-2">
            {!scanning ? (
              <Button onClick={startScanner}>
                <Camera className="mr-2 h-4 w-4" />
                Start Scanner
              </Button>
            ) : (
              <Button variant="outline" onClick={stopScanner}>
                <CameraOff className="mr-2 h-4 w-4" />
                Stop Scanner
              </Button>
            )}
          </div>
          {message && (
            <p className={`text-sm ${message.startsWith("Updated") || message.startsWith("Scanned") ? "text-emerald-600" : "text-red-600"}`}>
              {message}
            </p>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>Stock Count — {selected.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="quantity">Quantity ({selected.unit})</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save Count"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
