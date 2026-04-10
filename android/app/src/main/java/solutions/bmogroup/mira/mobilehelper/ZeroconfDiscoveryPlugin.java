// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

package solutions.bmogroup.mira.mobilehelper;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "ZeroconfDiscovery")
public class ZeroconfDiscoveryPlugin extends Plugin {
    private static final String SERVICE_TYPE = "_mira-mobile-sync._tcp.";

    @PluginMethod
    public void discover(PluginCall call) {
        Context context = getContext();
        NsdManager nsdManager = (NsdManager) context.getSystemService(Context.NSD_SERVICE);
        if (nsdManager == null) {
            JSObject payload = new JSObject();
            payload.put("services", new JSArray());
            call.resolve(payload);
            return;
        }

        int timeoutMs = call.getInt("timeoutMs", 4000);
        JSArray services = new JSArray();
        Set<String> seenServices = new HashSet<>();
        AtomicBoolean resolved = new AtomicBoolean(false);
        Handler handler = new Handler(Looper.getMainLooper());

        NsdManager.DiscoveryListener listener = new NsdManager.DiscoveryListener() {
            @Override
            public void onDiscoveryStarted(String regType) {
                // no-op
            }

            @Override
            public void onStartDiscoveryFailed(String serviceType, int errorCode) {
                finishDiscovery(call, nsdManager, this, services, resolved);
            }

            @Override
            public void onStopDiscoveryFailed(String serviceType, int errorCode) {
                finishDiscovery(call, nsdManager, this, services, resolved);
            }

            @Override
            public void onDiscoveryStopped(String serviceType) {
                finishDiscovery(call, nsdManager, this, services, resolved);
            }

            @Override
            public void onServiceFound(NsdServiceInfo serviceInfo) {
                if (!SERVICE_TYPE.equals(serviceInfo.getServiceType())) {
                    return;
                }
                String dedupeKey = serviceInfo.getServiceName() + "@" + serviceInfo.getServiceType();
                if (seenServices.contains(dedupeKey)) {
                    return;
                }
                seenServices.add(dedupeKey);
                nsdManager.resolveService(serviceInfo, new NsdManager.ResolveListener() {
                    @Override
                    public void onResolveFailed(NsdServiceInfo info, int errorCode) {
                        // Best effort only.
                    }

                    @Override
                    public void onServiceResolved(NsdServiceInfo info) {
                        services.put(toPayload(info));
                    }
                });
            }

            @Override
            public void onServiceLost(NsdServiceInfo serviceInfo) {
                // no-op
            }
        };

        handler.postDelayed(() -> finishDiscovery(call, nsdManager, listener, services, resolved), timeoutMs);
        try {
            nsdManager.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener);
        } catch (RuntimeException exception) {
            call.reject("Discovery could not start: " + exception.getMessage());
        }
    }

    private void finishDiscovery(
        PluginCall call,
        NsdManager nsdManager,
        NsdManager.DiscoveryListener listener,
        JSArray services,
        AtomicBoolean resolved
    ) {
        if (!resolved.compareAndSet(false, true)) {
            return;
        }
        try {
            nsdManager.stopServiceDiscovery(listener);
        } catch (IllegalArgumentException ignored) {
            // Discovery already stopped.
        }
        JSObject payload = new JSObject();
        payload.put("services", services);
        call.resolve(payload);
    }

    private JSObject toPayload(NsdServiceInfo info) {
        JSObject payload = new JSObject();
        payload.put("host", info.getHost() != null ? info.getHost().getHostAddress() : "");
        payload.put("port", info.getPort());
        payload.put("protocolVersion", attribute(info, "protocol_version", "1"));
        payload.put("pairingRequired", "1".equals(attribute(info, "pairing_required", "1")));
        payload.put("transportScheme", attribute(info, "transport_scheme", "https"));
        payload.put("tlsFingerprintSha256", attribute(info, "tls_fingerprint_sha256", ""));
        JSArray addresses = new JSArray();
        if (info.getHost() != null && info.getHost().getHostAddress() != null) {
            addresses.put(info.getHost().getHostAddress());
        }
        payload.put("advertisedAddresses", addresses);
        return payload;
    }

    private String attribute(NsdServiceInfo info, String key, String fallback) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
            return fallback;
        }
        Map<String, byte[]> attributes = info.getAttributes();
        if (attributes == null || !attributes.containsKey(key)) {
            return fallback;
        }
        byte[] rawValue = attributes.get(key);
        if (rawValue == null) {
            return fallback;
        }
        return new String(rawValue, StandardCharsets.UTF_8);
    }
}
