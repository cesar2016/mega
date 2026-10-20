import React from "react";
import { View } from "react-native";

/**
 * Grilla responsive sin VirtualizedList (las listas del mercado son cortas y
 * van dentro de un ScrollView). `columns` define cuántas tarjetas entran por
 * fila; el ancho de cada celda se calcula en porcentaje.
 */
export function Grid({
  columns,
  children,
  className = "",
}: {
  columns: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={`-mx-2 flex-row flex-wrap ${className}`}>
      {React.Children.map(children, (child) => (
        <View style={{ width: `${100 / columns}%` }} className="px-2 pb-4">
          {child}
        </View>
      ))}
    </View>
  );
}
