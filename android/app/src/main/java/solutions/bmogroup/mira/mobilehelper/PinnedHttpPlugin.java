// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

package solutions.bmogroup.mira.mobilehelper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.security.KeyManagementException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.Iterator;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import okhttp3.Headers;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

@CapacitorPlugin(name = "PinnedHttp")
public class PinnedHttpPlugin extends Plugin {
    @PluginMethod
    public void request(PluginCall call) {
        String url = call.getString("url", "").trim();
        String method = call.getString("method", "GET").trim().toUpperCase();
        String body = call.getString("body");
        String expectedFingerprint = call.getString("fingerprintSha256", "").trim().toLowerCase();
        JSObject headersObject = call.getObject("headers", new JSObject());

        if (url.isEmpty()) {
            call.reject("Pinned HTTP request requires a non-empty URL.", "validation_error");
            return;
        }
        if (!"GET".equals(method) && !"POST".equals(method)) {
            call.reject("Pinned HTTP plugin only supports GET and POST.", "validation_error");
            return;
        }
        if (expectedFingerprint.length() != 64) {
            call.reject("Pinned HTTP request requires a SHA-256 certificate fingerprint.", "validation_error");
            return;
        }

        getBridge().execute(() -> {
            try {
                OkHttpClient client = buildPinnedClient(expectedFingerprint);
                Request request = buildRequest(url, method, headersObject, body);
                try (Response response = client.newCall(request).execute()) {
                    JSObject payload = new JSObject();
                    payload.put("status", response.code());
                    payload.put("body", response.body() != null ? response.body().string() : "");
                    call.resolve(payload);
                }
            } catch (CertificateException exception) {
                call.reject(
                    "TLS certificate fingerprint mismatch.",
                    "certificate_pin_mismatch",
                    exception
                );
            } catch (IOException exception) {
                call.reject("Pinned HTTP request failed: " + exception.getMessage(), "network_error", exception);
            } catch (NoSuchAlgorithmException | KeyManagementException exception) {
                call.reject("Pinned HTTP initialization failed: " + exception.getMessage(), "internal_error", exception);
            }
        });
    }

    private OkHttpClient buildPinnedClient(String expectedFingerprint)
        throws NoSuchAlgorithmException, KeyManagementException {
        FingerprintTrustManager trustManager = new FingerprintTrustManager(expectedFingerprint);
        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(null, new TrustManager[] { trustManager }, new SecureRandom());
        SSLSocketFactory sslSocketFactory = sslContext.getSocketFactory();
        HostnameVerifier allowAnyHostname = new HostnameVerifier() {
            @Override
            public boolean verify(String hostname, SSLSession session) {
                return true;
            }
        };
        return new OkHttpClient.Builder()
            .sslSocketFactory(sslSocketFactory, trustManager)
            .hostnameVerifier(allowAnyHostname)
            .build();
    }

    private Request buildRequest(String url, String method, JSObject headersObject, String body) {
        Headers.Builder headersBuilder = new Headers.Builder();
        if (headersObject != null) {
            Iterator<String> iterator = headersObject.keys();
            while (iterator.hasNext()) {
                String key = iterator.next();
                String value = String.valueOf(headersObject.get(key));
                headersBuilder.add(key, value);
            }
        }

        Request.Builder requestBuilder = new Request.Builder().url(url).headers(headersBuilder.build());
        if ("POST".equals(method)) {
            String payload = body != null ? body : "";
            MediaType mediaType = MediaType.parse(headersBuilder.build().get("Content-Type") != null
                ? headersBuilder.build().get("Content-Type")
                : "application/json; charset=utf-8");
            requestBuilder.post(RequestBody.create(payload, mediaType));
        } else {
            requestBuilder.get();
        }
        return requestBuilder.build();
    }

    private static class FingerprintTrustManager implements X509TrustManager {
        private final String expectedFingerprint;

        FingerprintTrustManager(String expectedFingerprint) {
            this.expectedFingerprint = expectedFingerprint;
        }

        @Override
        public void checkClientTrusted(X509Certificate[] chain, String authType) {
            // Not used for this plugin.
        }

        @Override
        public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
            if (chain == null || chain.length == 0 || chain[0] == null) {
                throw new CertificateException("Server did not provide an X509 certificate chain.");
            }
            String actualFingerprint = sha256Hex(chain[0]);
            if (!expectedFingerprint.equalsIgnoreCase(actualFingerprint)) {
                throw new CertificateException("TLS certificate fingerprint mismatch.");
            }
        }

        @Override
        public X509Certificate[] getAcceptedIssuers() {
            return new X509Certificate[0];
        }

        private static String sha256Hex(X509Certificate certificate) throws CertificateException {
            try {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                byte[] hash = digest.digest(certificate.getEncoded());
                StringBuilder builder = new StringBuilder(hash.length * 2);
                for (byte value : hash) {
                    builder.append(String.format("%02x", value));
                }
                return builder.toString();
            } catch (NoSuchAlgorithmException exception) {
                throw new CertificateException("SHA-256 algorithm unavailable.", exception);
            }
        }
    }
}
