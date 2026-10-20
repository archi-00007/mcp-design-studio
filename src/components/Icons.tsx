import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 16, strokeWidth = 1.6, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const BoxIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 8.2 12 3.2 3 8.2v7.6l9 5 9-5V8.2Z" />
    <path d="M3 8.2 12 13l9-4.8M12 13v7.8" />
  </Svg>
)

export const ListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12M3.8 6.5h.01M3.8 12h.01M3.8 17.5h.01" />
  </Svg>
)

/** 导出：箭头出托盘 */
export const ExportIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 15.5V18a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2.5" />
    <path d="M12 15V3.5M8 7.5 12 3.5l4 4" />
  </Svg>
)

/** 导入：箭头入托盘 */
export const ImportIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 15.5V18a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2.5" />
    <path d="M12 3.5V15M8 11l4 4 4-4" />
  </Svg>
)

export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8.6 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </Svg>
)

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </Svg>
)

export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M16.8 3.3a2.85 2.85 0 0 1 4 4L7.6 20.5 2 22l1.5-5.6L16.8 3.3Z" />
  </Svg>
)

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 6h17M9 6V4.2A1.2 1.2 0 0 1 10.2 3h3.6A1.2 1.2 0 0 1 15 4.2V6" />
    <path d="M18.6 6 17.7 19a2 2 0 0 1-2 1.9H8.3a2 2 0 0 1-2-1.9L5.4 6" />
    <path d="M10 10.5v6M14 10.5v6" />
  </Svg>
)

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Svg>
)

export const MinusIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.2 12h7.6" />
  </Svg>
)

/** 圈叉：减号被激活成「确认删除」时的形态 */
export const XCircleIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m9.3 9.3 5.4 5.4M14.7 9.3l-5.4 5.4" />
  </Svg>
)

export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9.5 6 6 6-6" />
  </Svg>
)

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Svg>
)

export const ArrowLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H5M11.5 19 4.5 12l7-7" />
  </Svg>
)

export const XIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
)

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 6.5 9.2 17.3 3.8 11.9" />
  </Svg>
)

export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 21 20H3l9-16.5Z" />
    <path d="M12 9.5v4.2M12 17h.01" />
  </Svg>
)

export const CodeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
  </Svg>
)

export const MoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
)

export const InfoIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5M12 8h.01" />
  </Svg>
)

/** 文档：导出产物 Markdown 的图标 */
export const FileTextIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8l-5-5Z" />
    <path d="M14 3v5h5M8.8 13h6.4M8.8 17h4.4" />
  </Svg>
)

/** 堆叠：导出产物 IR 的图标 */
export const LayersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 3 7.6l9 4.6 9-4.6L12 3Z" />
    <path d="m3 12.4 9 4.6 9-4.6M3 16.8l9 4.6 9-4.6" />
  </Svg>
)

export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 15.5V18a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2.5" />
    <path d="M12 3.5V15M8 11l4 4 4-4" />
  </Svg>
)

/** 拖拽手柄：六点阵列，仅靠 fill 画点，不要描边 */
export const GripIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={0}>
    <circle cx="9" cy="7" r="1.35" fill="currentColor" />
    <circle cx="15" cy="7" r="1.35" fill="currentColor" />
    <circle cx="9" cy="12" r="1.35" fill="currentColor" />
    <circle cx="15" cy="12" r="1.35" fill="currentColor" />
    <circle cx="9" cy="17" r="1.35" fill="currentColor" />
    <circle cx="15" cy="17" r="1.35" fill="currentColor" />
  </Svg>
)
