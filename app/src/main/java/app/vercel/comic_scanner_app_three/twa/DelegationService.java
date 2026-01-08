package app.vercel.comic_scanner_app_three.twa;


import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;


public class DelegationService extends
        com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();

        
            registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
        
    }
}

