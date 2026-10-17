package io.github.glosspdf;

import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Android yazdırma penceresi (yazıcı, "PDF olarak kaydet"). WebView window.print() desteklemez.
 * Kaynak dosya uygulamanın önbelleğinde olmalı (share.ts oraya yazar).
 *
 * JS: PrintFile.print({ uri, name }) → pencere açılınca çözülür
 */
@CapacitorPlugin(name = "PrintFile")
public class PrintFilePlugin extends Plugin {

    @PluginMethod
    public void print(PluginCall call) {
        File source;
        try {
            String path = Uri.parse(call.getString("uri", "")).getPath();
            String cacheDir = getContext().getCacheDir().getCanonicalPath() + File.separator;
            source = path == null ? null : new File(path).getCanonicalFile();
            if (source == null || !source.getPath().startsWith(cacheDir) || !source.isFile()) {
                throw new IOException("Source must be a file in the app cache");
            }
        } catch (IOException e) {
            call.reject(e.getMessage());
            return;
        }
        String name = call.getString("name", "document.pdf");

        getActivity().runOnUiThread(() -> {
            PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            manager.print(name, new PdfAdapter(source, name), null);
            call.resolve();
        });
    }

    /** PDF zaten hazır: düzen adımı yok, dosya olduğu gibi yazdırma hizmetine verilir. */
    private static class PdfAdapter extends PrintDocumentAdapter {
        private final File source;
        private final String name;

        PdfAdapter(File source, String name) {
            this.source = source;
            this.name = name;
        }

        @Override
        public void onLayout(PrintAttributes oldAttrs, PrintAttributes newAttrs, CancellationSignal cancel, LayoutResultCallback callback, Bundle extras) {
            if (cancel.isCanceled()) {
                callback.onLayoutCancelled();
                return;
            }
            PrintDocumentInfo info = new PrintDocumentInfo.Builder(name)
                .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
                .build();
            callback.onLayoutFinished(info, !newAttrs.equals(oldAttrs));
        }

        @Override
        public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal cancel, WriteResultCallback callback) {
            try (
                InputStream in = new FileInputStream(source);
                OutputStream out = new FileOutputStream(destination.getFileDescriptor())
            ) {
                byte[] buffer = new byte[64 * 1024];
                int n;
                while ((n = in.read(buffer)) != -1) {
                    if (cancel.isCanceled()) {
                        callback.onWriteCancelled();
                        return;
                    }
                    out.write(buffer, 0, n);
                }
                callback.onWriteFinished(new PageRange[] { PageRange.ALL_PAGES });
            } catch (IOException e) {
                callback.onWriteFailed(e.getMessage());
            }
        }
    }
}
