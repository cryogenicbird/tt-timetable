package com.timetableapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import android.content.Context
import android.os.Vibrator

class VibrationModule(ctx:ReactApplicationContext):
ReactContextBaseJavaModule(ctx){
    
    override fun getName(): String="VibrationModule"

    private val vibratorService=reactApplicationContext.
            getSystemService(Context.VIBRATOR_SERVICE)as Vibrator
    @ReactMethod
    fun vibrate(duration:Double){
        vibratorService.vibrate(duration.toLong())
    }
 }
    