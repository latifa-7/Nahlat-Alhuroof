package com.nahla.huroof;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.util.Locale;

/** يعرض التطبيق داخل WebView ويوفّر النطق العربي عبر محرك الصوت في أندرويد. */
public class MainActivity extends Activity {
    private WebView web;
    private TextToSpeech tts;
    private volatile boolean arabicReady = false;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.parseColor("#FFD23F"));
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(new Locale("ar"));
                arabicReady = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
                tts.setSpeechRate(0.85f);
            }
        });
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "AndroidTTS");
        setContentView(web);
        web.loadUrl("file:///android_asset/www/index.html");
    }

    class Bridge {
        @JavascriptInterface public boolean hasArabic() { return arabicReady; }
        @JavascriptInterface public void speak(String text) {
            if (tts != null) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "u");
        }
    }

    @Override
    public void onBackPressed() {
        // زر الرجوع يعيد الطفل إلى الشاشة الرئيسية بدل إغلاق التطبيق فجأة
        web.evaluateJavascript("(function(){var b=document.querySelector('.top .ib');if(b&&b.textContent.trim()==='➜'){b.click();return 'back';}return 'exit';})()",
            v -> { if (v != null && v.contains("exit")) MainActivity.super.onBackPressed(); });
    }

    @Override
    protected void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        super.onDestroy();
    }
}
