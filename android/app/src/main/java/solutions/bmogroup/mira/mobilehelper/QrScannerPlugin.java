// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

package solutions.bmogroup.mira.mobilehelper;

import android.Manifest;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

@CapacitorPlugin(
    name = "QrScanner",
    permissions = {
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA })
    }
)
public class QrScannerPlugin extends Plugin {
    @PluginMethod
    public void scan(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "scanAfterPermission");
            return;
        }
        startScan(call);
    }

    @PermissionCallback
    private void scanAfterPermission(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            call.reject("Camera permission denied.", "permission_denied");
            return;
        }
        startScan(call);
    }

    private void startScan(PluginCall call) {
        if (getActivity() == null) {
            call.reject("QR scanner is unavailable.", "unavailable");
            return;
        }

        GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(getActivity());
        scanner.startScan()
            .addOnSuccessListener(barcode -> resolveBarcode(call, barcode))
            .addOnCanceledListener(() -> call.reject("QR scan cancelled.", "cancelled"))
            .addOnFailureListener(exception -> call.reject(
                "QR scan failed: " + exception.getMessage(),
                "scan_failed"
            ));
    }

    private void resolveBarcode(PluginCall call, Barcode barcode) {
        String rawValue = barcode.getRawValue();
        if (rawValue == null || rawValue.trim().isEmpty()) {
            call.reject("QR scan did not return any payload.", "scan_failed");
            return;
        }
        JSObject payload = new JSObject();
        payload.put("rawText", rawValue);
        call.resolve(payload);
    }
}
