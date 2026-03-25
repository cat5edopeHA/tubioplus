#!/bin/bash
if [ -n "$VNC_PASSWORD" ]; then
    x11vnc -storepasswd "$VNC_PASSWORD" /etc/x11vnc.pass
    exec x11vnc -display :99 -rfbauth /etc/x11vnc.pass -listen 0.0.0.0 -forever -shared
else
    exec x11vnc -display :99 -nopw -listen 0.0.0.0 -forever -shared
fi
