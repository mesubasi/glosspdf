package io.github.glosspdf;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Yerel eklentiler super.onCreate'ten önce kaydedilmeli
        registerPlugin(SaveFilePlugin.class);
        registerPlugin(IncomingFilePlugin.class);
        registerPlugin(PrintFilePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
