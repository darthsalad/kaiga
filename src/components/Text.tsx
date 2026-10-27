import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

type Variant = 'display' | 'headline' | 'title' | 'body' | 'label' | 'caption';
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

const variants: Record<Variant, TextStyle & { weight: Weight }> = {
	display: { fontSize: 36, lineHeight: 42, letterSpacing: -0.5, weight: 'bold' },
	headline: { fontSize: 26, lineHeight: 30, letterSpacing: -0.2, weight: 'bold' },
	title: { fontSize: 15, lineHeight: 20, weight: 'bold' },
	body: { fontSize: 14, lineHeight: 20, weight: 'semibold' },
	label: { fontSize: 13, lineHeight: 18, weight: 'semibold' },
	caption: { fontSize: 12, lineHeight: 16, weight: 'regular' },
};

export type AppTextProps = TextProps & {
	variant?: Variant;
	weight?: Weight;
	muted?: boolean;
	color?: string;
};

/** Android picks fonts by family name, not fontWeight, so each weight maps to its own file. */
export function Text({ variant = 'body', weight, muted, color, style, ...rest }: AppTextProps) {
	const theme = useTheme();
	const { weight: defaultWeight, ...base } = variants[variant];
	const fontFamily = variant === 'display' || variant === 'headline' ? fonts.display : fonts[weight ?? defaultWeight];
	return (
		<RNText {...rest} style={[base, { fontFamily, color: color ?? (muted ? theme.textMuted : theme.text) }, style]} />
	);
}
