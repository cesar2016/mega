import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";

const VIDEO_ASSET = require("../../assets/videos/hacienda-bg.mp4");

const CANVAS_COLOR = "#F7FAF8";
const TRANSPARENT_CANVAS = "rgba(247, 250, 248, 0)";

interface BackgroundVideoProps {
  className?: string;
  /** Opacidad del video de fondo (1 por defecto para verse normal, nítido y con colores reales). */
  opacity?: number;
  /** Si debe fundir los bordes superior, inferior y laterales con el fondo canvas. */
  fadeEdges?: boolean;
}

function EdgeFades() {
  return (
    <>
      {/* Borde superior fundido */}
      <LinearGradient
        colors={[CANVAS_COLOR, TRANSPARENT_CANVAS]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.edgeTop}
        pointerEvents="none"
      />

      {/* Borde inferior fundido */}
      <LinearGradient
        colors={[TRANSPARENT_CANVAS, CANVAS_COLOR]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.edgeBottom}
        pointerEvents="none"
      />

      {/* Borde izquierdo fundido */}
      <LinearGradient
        colors={[CANVAS_COLOR, TRANSPARENT_CANVAS]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.edgeLeft}
        pointerEvents="none"
      />

      {/* Borde derecho fundido */}
      <LinearGradient
        colors={[TRANSPARENT_CANVAS, CANVAS_COLOR]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.edgeRight}
        pointerEvents="none"
      />
    </>
  );
}

export function BackgroundVideo({
  className = "",
  opacity = 1,
  fadeEdges = true,
}: BackgroundVideoProps) {
  if (Platform.OS === "web") {
    return (
      <View style={StyleSheet.absoluteFill} className={className} pointerEvents="none">
        <video
          src="/videos/hacienda-bg.mp4"
          poster="/videos/hacienda-poster.jpg"
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity,
            pointerEvents: "none",
            maskImage: fadeEdges
              ? "radial-gradient(ellipse 92% 88% at 50% 50%, black 55%, rgba(0, 0, 0, 0.75) 78%, transparent 98%)"
              : undefined,
            WebkitMaskImage: fadeEdges
              ? "radial-gradient(ellipse 92% 88% at 50% 50%, black 55%, rgba(0, 0, 0, 0.75) 78%, transparent 98%)"
              : undefined,
          }}
        />

        {fadeEdges && <EdgeFades />}
      </View>
    );
  }

  return <NativeBackgroundVideo className={className} opacity={opacity} fadeEdges={fadeEdges} />;
}

function NativeBackgroundVideo({
  className = "",
  opacity = 1,
  fadeEdges = true,
}: {
  className?: string;
  opacity?: number;
  fadeEdges?: boolean;
}) {
  const player = useVideoPlayer(VIDEO_ASSET, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={StyleSheet.absoluteFill} className={className} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { opacity }]}>
        <VideoView
          player={player}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          nativeControls={false}
        />
      </View>
      {fadeEdges && <EdgeFades />}
    </View>
  );
}

const styles = StyleSheet.create({
  edgeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  edgeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  edgeLeft: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 100,
  },
  edgeRight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 100,
  },
});
