package io.github.glosspdf;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Android'in "Farklı kaydet" penceresi (Storage Access Framework).
 * Tek dosyada ACTION_CREATE_DOCUMENT, birden çok dosyada klasör seçtirip (ACTION_OPEN_DOCUMENT_TREE)
 * dosyaları oraya yazar. Kaynak dosyalar uygulamanın önbelleğinde olmalı (share.ts oraya yazar).
 *
 * JS: SaveFile.save({ files: [{ uri, name, mime }] }) → { saved: number } (iptal = 0)
 */
@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {

    private static class Item {
        final File source;
        final String name;
        final String mime;

        Item(File source, String name, String mime) {
            this.source = source;
            this.name = name;
            this.mime = mime;
        }
    }

    @PluginMethod
    public void save(PluginCall call) {
        List<Item> items;
        try {
            items = readItems(call);
        } catch (Exception e) {
            call.reject(e.getMessage());
            return;
        }

        Intent intent;
        if (items.size() == 1) {
            intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(items.get(0).mime);
            intent.putExtra(Intent.EXTRA_TITLE, items.get(0).name);
            startActivityForResult(call, intent, "onCreateDocument");
        } else {
            intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            startActivityForResult(call, intent, "onPickFolder");
        }
    }

    @ActivityCallback
    private void onCreateDocument(PluginCall call, ActivityResult result) {
        Uri target = resultUri(result);
        if (target == null) {
            resolveSaved(call, 0);
            return;
        }
        getBridge().execute(() -> {
            try {
                Item item = readItems(call).get(0);
                copy(item.source, target);
                resolveSaved(call, 1);
            } catch (Exception e) {
                call.reject("Save failed: " + e.getMessage());
            }
        });
    }

    @ActivityCallback
    private void onPickFolder(PluginCall call, ActivityResult result) {
        Uri tree = resultUri(result);
        if (tree == null) {
            resolveSaved(call, 0);
            return;
        }
        getBridge().execute(() -> {
            try {
                ContentResolver resolver = getContext().getContentResolver();
                Uri parent = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
                int saved = 0;
                for (Item item : readItems(call)) {
                    // Aynı adda dosya varsa sağlayıcı adı kendisi değiştirir ("ad (1).pdf")
                    Uri doc = DocumentsContract.createDocument(resolver, parent, item.mime, item.name);
                    if (doc == null) throw new IOException("Could not create " + item.name);
                    copy(item.source, doc);
                    saved++;
                }
                resolveSaved(call, saved);
            } catch (Exception e) {
                call.reject("Save failed: " + e.getMessage());
            }
        });
    }

    private static Uri resultUri(ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) return null;
        return result.getData().getData();
    }

    private static void resolveSaved(PluginCall call, int saved) {
        JSObject ret = new JSObject();
        ret.put("saved", saved);
        call.resolve(ret);
    }

    /** JS'ten gelen listeyi okur; kaynak yalnızca uygulamanın önbellek klasöründen olabilir. */
    private List<Item> readItems(PluginCall call) throws JSONException, IOException {
        JSArray files = call.getArray("files");
        if (files == null || files.length() == 0) throw new IOException("No files given");

        String cacheDir = getContext().getCacheDir().getCanonicalPath() + File.separator;
        List<Item> items = new ArrayList<>();
        for (int i = 0; i < files.length(); i++) {
            JSONObject f = files.getJSONObject(i);
            String path = Uri.parse(f.getString("uri")).getPath();
            File source = path == null ? null : new File(path).getCanonicalFile();
            if (source == null || !source.getPath().startsWith(cacheDir) || !source.isFile()) {
                throw new IOException("Source must be a file in the app cache");
            }
            items.add(new Item(source, f.getString("name"), f.getString("mime")));
        }
        return items;
    }

    private void copy(File source, Uri target) throws IOException {
        try (
            InputStream in = new FileInputStream(source);
            OutputStream out = getContext().getContentResolver().openOutputStream(target, "wt")
        ) {
            if (out == null) throw new IOException("Cannot open target");
            byte[] buffer = new byte[64 * 1024];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
        }
    }
}
