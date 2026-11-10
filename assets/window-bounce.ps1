param(
  [Parameter(Mandatory = $true)][int]$ProcessId,
  [Parameter(Mandatory = $true)][string]$StopFile,
  [int]$Jump = 26,
  [int]$Period = 1000
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class DshWindowBounce
{
    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);
    [DllImport("user32.dll")]
    private static extern bool IsZoomed(IntPtr hWnd);
    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")]
    private static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")]
    private static extern bool SetProcessDpiAwarenessContext(IntPtr value);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    private static uint targetPid;
    private static IntPtr bestWindow;
    private static long bestArea;
    private static string bestTitle;

    public static int Run(int pid, string stopFile, int jump, int periodMs)
    {
        try { SetProcessDpiAwarenessContext(new IntPtr(-4)); }
        catch { try { SetProcessDPIAware(); } catch { } }

        targetPid = (uint)pid;
        bestWindow = IntPtr.Zero;
        bestArea = -1;
        bestTitle = "";

        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
        {
            uint windowPid;
            GetWindowThreadProcessId(hWnd, out windowPid);
            if (windowPid != targetPid) return true;
            if (!IsWindowVisible(hWnd)) return true;
            int titleLength = GetWindowTextLength(hWnd);
            if (titleLength <= 0) return true;

            RECT rect;
            if (!GetWindowRect(hWnd, out rect)) return true;
            long area = (long)(rect.Right - rect.Left) * (long)(rect.Bottom - rect.Top);
            if (area > bestArea)
            {
                StringBuilder title = new StringBuilder(titleLength + 1);
                GetWindowText(hWnd, title, title.Capacity);
                bestWindow = hWnd;
                bestArea = area;
                bestTitle = title.ToString();
            }
            return true;
        }, IntPtr.Zero);

        if (bestWindow == IntPtr.Zero)
        {
            EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
            {
                if (!IsWindowVisible(hWnd)) return true;
                int titleLength = GetWindowTextLength(hWnd);
                if (titleLength <= 0) return true;
                StringBuilder title = new StringBuilder(titleLength + 1);
                GetWindowText(hWnd, title, title.Capacity);
                if (title.ToString().IndexOf("DeepSeek Harness", StringComparison.OrdinalIgnoreCase) < 0) return true;

                RECT rect;
                if (!GetWindowRect(hWnd, out rect)) return true;
                long area = (long)(rect.Right - rect.Left) * (long)(rect.Bottom - rect.Top);
                if (area > bestArea)
                {
                    bestWindow = hWnd;
                    bestArea = area;
                    bestTitle = title.ToString();
                }
                return true;
            }, IntPtr.Zero);
        }

        if (bestWindow == IntPtr.Zero) return 2;
        if (IsZoomed(bestWindow) || IsIconic(bestWindow)) return 2;

        RECT baseRect;
        if (!GetWindowRect(bestWindow, out baseRect)) return 2;
        int baseLeft = baseRect.Left;
        int baseTop = baseRect.Top;
        int width = baseRect.Right - baseRect.Left;
        int height = baseRect.Bottom - baseRect.Top;
        if (width <= 0 || height <= 0) return 2;

        const uint flags = 0x0001 | 0x0004 | 0x0010; // NOSIZE | NOZORDER | NOACTIVATE
        DateTime started = DateTime.UtcNow;
        bool aborted = false;

        while (true)
        {
            if (File.Exists(stopFile)) break;
            if (IsZoomed(bestWindow) || IsIconic(bestWindow))
            {
                aborted = true;
                break;
            }

            RECT current;
            if (!GetWindowRect(bestWindow, out current))
            {
                aborted = true;
                break;
            }
            if (current.Left != baseLeft ||
                (current.Right - current.Left) != width ||
                (current.Bottom - current.Top) != height)
            {
                // The user moved or resized the window; do not fight them.
                aborted = true;
                break;
            }

            if ((DateTime.UtcNow - started).TotalMilliseconds > 1800000.0)
            {
                break;
            }

            double phase = ((DateTime.UtcNow - started).TotalMilliseconds % (double)periodMs) / (double)periodMs;
            double lift = 0.0;
            if (phase >= 0.14 && phase < 0.82)
            {
                double u = (phase - 0.14) / 0.68;
                lift = 0.5 - 0.5 * Math.Cos(u * 2.0 * Math.PI);
            }

            int y = baseTop - (int)Math.Round((double)jump * lift);
            SetWindowPos(bestWindow, IntPtr.Zero, baseLeft, y, 0, 0, flags);
            Thread.Sleep(15);
        }

        if (!aborted)
        {
            RECT final;
            if (GetWindowRect(bestWindow, out final) &&
                final.Left == baseLeft &&
                (final.Right - final.Left) == width &&
                (final.Bottom - final.Top) == height)
            {
                SetWindowPos(bestWindow, IntPtr.Zero, baseLeft, baseTop, 0, 0, flags);
            }
        }

        return aborted ? 2 : 0;
    }
}
'@

$code = [DshWindowBounce]::Run($ProcessId, $StopFile, $Jump, $Period)
exit $code
