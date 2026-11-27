import {
  AcUnitRounded,
  BlockRounded,
  BuildCircleRounded,
  CheckCircleRounded,
  DoNotDisturbOnRounded,
  GroupsRounded,
  PauseCircleFilledRounded,
  ScheduleRounded,
  WarningAmberRounded,
} from '@mui/icons-material';
import type { StatusIconKey } from '../constants/statusVisual';

interface StatusIconProps {
  iconKey: StatusIconKey;
  color?: string;
  fontSize?: 'small' | 'medium' | 'inherit';
}

export function StatusIcon({ iconKey, color, fontSize = 'small' }: StatusIconProps) {
  const sx = color ? { color } : undefined;

  switch (iconKey) {
    case 'normal':
      return <CheckCircleRounded fontSize={fontSize} sx={sx} />;
    case 'atencao':
      return <WarningAmberRounded fontSize={fontSize} sx={sx} />;
    case 'paralisada':
      return <BlockRounded fontSize={fontSize} sx={sx} />;
    case 'lotada':
      return <GroupsRounded fontSize={fontSize} sx={sx} />;
    case 'fechada':
      return <DoNotDisturbOnRounded fontSize={fontSize} sx={sx} />;
    case 'atraso':
      return <ScheduleRounded fontSize={fontSize} sx={sx} />;
    case 'parado':
      return <PauseCircleFilledRounded fontSize={fontSize} sx={sx} />;
    case 'ar_condicionado':
      return <AcUnitRounded fontSize={fontSize} sx={sx} />;
    case 'avariado':
      return <BuildCircleRounded fontSize={fontSize} sx={sx} />;
  }
}
