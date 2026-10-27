package it.portafogliobot.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * L'app e' una finestra a schermo intero sul sito del portafoglio.
 * Il sito vive su GitHub Pages: ogni sua miglioria arriva qui da sola,
 * senza bisogno di un nuovo APK. I dati del bot sono quelli pubblici
 * (ramo "dati" di trading-app), quindi non serve nessuna chiave.
 */
public class MainActivity extends Activity {
    static final String HOME = "https://francesco209177.github.io/trading-app/";
    static final String HOST = "francesco209177.github.io";

    // Tasto Indietro: prima chiude le impostazioni, poi torna alla Home,
    // e solo dalla Home esce dall'app. Il sito cambia pagina senza
    // cronologia, quindi lo chiediamo direttamente al suo router.
    static final String BACK_JS =
        "(function(){try{"
            + "var s=document.getElementById('settings');"
            + "if(s&&!s.hidden){s.hidden=true;return 'ok';}"
            + "if(typeof Router!=='undefined'&&Router.current&&Router.current!=='home'){Router.go('home');return 'ok';}"
            + "}catch(e){}return 'esci';})()";

    static final String OFFLINE =
        "<html><body style='background:#0b0d12;color:#e6e8ee;font-family:sans-serif;"
            + "display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;text-align:center'>"
            + "<h2>Nessuna connessione</h2><p>Il portafoglio ha bisogno di Internet per i prezzi e i dati del bot.</p>"
            + "<button style='margin-top:16px;padding:12px 24px;border:0;border-radius:10px;background:#5b6cff;color:#fff;font-size:16px' "
            + "onclick=\"location.href='" + HOME + "'\">Riprova</button></body></html>";

    private WebView web;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0b0d12"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // preferenze e cambio euro nel localStorage, come nel browser
        web.setWebViewClient(new Client());
        setContentView(web);

        // Android a volte ricrea la finestra (rotazione, aggiornamento di WebView):
        // si riprende dalla pagina di prima, ma se non c'era ancora niente si carica da capo.
        if (saved != null) web.restoreState(saved);
        if (web.copyBackForwardList().getSize() == 0) web.loadUrl(HOME);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.resumeTimers();
    }

    @Override
    protected void onPause() {
        // In background il sito si ferma: niente prezzi in diretta a vuoto.
        web.onPause();
        web.pauseTimers();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        ((ViewGroup) web.getParent()).removeView(web);
        web.destroy();
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript(BACK_JS, result -> {
            if (!"\"ok\"".equals(result)) finish();
        });
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (HOST.equals(url.getHost())) return false;
            // Link esterni (GitHub, Kraken...): nel browser del telefono, non dentro l'app.
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));
            } catch (Exception ignored) {
            }
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) view.loadDataWithBaseURL(null, OFFLINE, "text/html", "utf-8", null);
        }
    }
}
