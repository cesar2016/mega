import React from "react";
import { Text, TextInput, View } from "react-native";
import type { KeyboardTypeOptions } from "react-native";
import { Icon } from "./Icon";
import type { IconName } from "./Icon.types";

type InputProps = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  icon?: IconName;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  className?: string;
  inputClassName?: string;
  testID?: string;
};

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  icon,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  multiline,
  numberOfLines,
  editable = true,
  className = "",
  inputClassName = "",
  testID,
}: InputProps) {
  const hasError = Boolean(error);

  return (
    <View className={`w-full gap-1.5 ${className}`}>
      {label ? (
        <Text className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {label}
        </Text>
      ) : null}

      <View
        className={[
          "w-full flex-row items-center gap-2.5 rounded-2xl border bg-surface px-3.5",
          "focus-within:border-sage-400 focus-within:bg-surface",
          hasError ? "border-clay-400" : "border-line",
          multiline ? "items-start py-3" : "py-2.5",
          editable ? "" : "opacity-60",
        ].join(" ")}
      >
        {icon ? (
          <Icon
            name={icon}
            size={18}
            className={hasError ? "text-clay-500" : "text-ink-muted"}
          />
        ) : null}

        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderClassName="text-ink-muted"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          className={[
            "flex-1 text-base text-ink",
            multiline ? "min-h-[88px] text-left" : "",
            inputClassName,
          ].join(" ")}
        />
      </View>

      {hasError ? (
        <Text className="text-xs font-medium text-clay-600">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-ink-muted">{hint}</Text>
      ) : null}
    </View>
  );
}
