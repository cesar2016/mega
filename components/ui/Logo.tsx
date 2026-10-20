import React from "react";
import { Image, ImageProps } from "react-native";

const LOGO_SRC = require("../../assets/logo_mega.png");

export interface LogoProps extends Omit<ImageProps, "source"> {
  size?: number;
  className?: string;
}

export function Logo({ size = 44, className = "", style, ...props }: LogoProps) {
  return (
    <Image
      source={LOGO_SRC}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      className={className}
      {...props}
    />
  );
}
