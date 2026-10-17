package io.github.glosspdf;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import androidx.core.content.IntentCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * "Birlikte aç" (ACTION_VIEW) ve "Paylaş" (ACTION_SEND) ile gelen PDF'i web katmanına bildirir.
 * Web katmanı baytları Capacitor.convertFileSrc(uri) ile okur; dosya kopyalanmaz.
 */
@CapacitorPlugin(name = "IncomingFile")
public class IncomingFilePlugin extends Plugin {

    @Override
    public void load() {
        handle(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handle(intent);
    }

    private void handle(Intent intent) {
        if (intent == null) return;
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) {
            uri = intent.getData();
        } else if (Intent.ACTION_SEND.equals(intent.getAction())) {
            uri = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri.class);
        }
        if (uri == null || !"content".equals(uri.getScheme())) return;
        // Aynı intent ikinci kez işlenmesin
        intent.setAction(Intent.ACTION_MAIN);

        JSObject file = new JSObject();
        file.put("uri", uri.toString());
        file.put("name", displayName(uri));
        // Web katmanı henüz dinlemiyorsa (soğuk açılış) olay dinleyici eklenene kadar bekletilir
        notifyListeners("file", file, true);
    }

    private String displayName(Uri uri) {
        try (Cursor c = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst() && !c.isNull(0)) return c.getString(0);
        } catch (Exception ignored) {
            // Ad sorgulanamazsa adresin son parçası kullanılır
        }
        String last = uri.getLastPathSegment();
        return last != null ? last : "document.pdf";
    }
}
