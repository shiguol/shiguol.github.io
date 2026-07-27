---
title: "Ubuntu 升级内核后 Kernel Panic：VFS: Unable to mount root fs on unknown-block(0,0) 修复实录"
date: 2026-07-27 21:00:00
cover: /images/cover/ubuntu-kernel-panic.webp
categories:
  - Programming
tags:
  - Ubuntu
  - Linux
  - 内核
  - initramfs
  - DKMS
  - GRUB
  - 运维
  - 2026
---

一台 Ubuntu 24.04 机器升级 HWE 内核后重启失败，屏幕停在 `VFS: Unable to mount root fs on unknown-block(0,0)`。这类故障最容易被误判为「根分区坏了」，但真正的根因往往是 initramfs 没有生成。本文完整记录从临时恢复、逐层排查到最终修复的全过程，并梳理出一套通用排障思路。

<!-- more -->

## 故障现象

一台 Ubuntu 24.04 机器升级 HWE 内核后重启失败，屏幕显示：

```text
Kernel panic - not syncing: VFS: Unable to mount root fs on unknown-block(0,0)
```

GRUB 中选择旧的 `6.17.0-35-generic` 可以正常启动，但默认选择的
`7.0.0-28-generic` 无法进入系统。

`unknown-block(0,0)` 中的 `(0,0)` 是一个重要线索：内核启动后没有得到可用于挂载
根文件系统的块设备。这通常意味着 initramfs 缺失、损坏，或者 initramfs 中缺少
存储控制器、LVM、RAID、加密卷等启动所需模块。它不一定代表根分区本身已经损坏。

## 临时恢复系统

开机进入 GRUB：

1. 选择 **Advanced options for Ubuntu**。
2. 选择已知可用的旧内核，本次为 `6.17.0-35-generic`。
3. 启动后先不要删除旧内核，它是修复失败时的回退入口。

如果 GRUB 默认隐藏，可在开机时按住 `Shift`（传统 BIOS）或连续按 `Esc`（UEFI）
调出菜单。

## 排查过程

### 1. 确认当前运行的内核

```bash
uname -r
```

输出：

```text
6.17.0-35-generic
```

这说明机器确实是通过旧内核恢复启动的。

### 2. 检查内核与 initramfs 是否完整

```bash
ls -lh /boot/vmlinuz* /boot/initrd.img*
```

关键结果如下：

```text
/boot/vmlinuz-6.17.0-35-generic
/boot/initrd.img-6.17.0-35-generic
/boot/vmlinuz-7.0.0-28-generic
```

`7.0.0-28` 的内核镜像存在，但对应的
`/boot/initrd.img-7.0.0-28-generic` 不存在。与此同时，`/boot/initrd.img`
符号链接指向这个不存在的文件。

这已经足以解释启动失败：GRUB 能加载 7.0 内核，却没有可用的 initramfs 帮助内核
识别和挂载根分区。

### 3. 检查软件包状态

```bash
dpkg -l 'linux-image*' 'linux-headers*' 'linux-modules*' |
  grep '7.0.0-28'
```

异常状态：

```text
iF  linux-image-7.0.0-28-generic
iF  linux-headers-7.0.0-28-generic
iU  linux-generic-hwe-24.04
```

`dpkg -l` 的前两列很关键：

- `ii`：软件包已正确安装并配置。
- `iU`：已解包，但尚未配置。
- `iF`：已安装，但配置失败。

因此，问题并不是一个“安装完整但无法兼容硬件”的正常内核，而是内核包的安装流程
在配置阶段中断了。

### 4. 查看安装日志

```bash
grep -E '7\.0\.0-28|initramfs|error|fail' /var/log/apt/term.log
```

日志中的核心错误：

```text
dkms autoinstall on 7.0.0-28-generic/x86_64 failed for linux-apfs-rw
Error! Bad return status for module build on kernel: 7.0.0-28-generic
installed linux-image-7.0.0-28-generic package post-installation script
subprocess returned error exit status 11
```

机器安装了 `apfs-dkms`。其中的 `linux-apfs-rw` 模块无法针对 7.0 内核编译，
导致 DKMS 返回失败；内核 post-install 脚本随之中断，最终没有生成 initramfs，
内核包也一直停留在 `iF` 状态。

NVIDIA DKMS 模块在两个内核版本上均编译成功，因此与本次故障无关。

### 5. 排除磁盘空间和 UUID 问题

```bash
df -h / /boot /boot/efi
lsblk -f
cat /proc/cmdline
```

检查确认：

- `/boot` 位于根文件系统中，仍有约 52 GB 可用空间。
- EFI 分区仍有约 60 MB 可用空间。
- 根分区 UUID 与启动参数中的 `root=UUID=...` 一致。
- NVMe 磁盘和根分区在旧内核下识别正常。

因此，磁盘空间不足、根分区 UUID 错误和磁盘失联均不是本次故障原因。

## 修复步骤

### 1. 先生成缺失的 initramfs

```bash
sudo update-initramfs -c -k 7.0.0-28-generic
```

确认文件已经生成：

```bash
ls -lh /boot/initrd.img-7.0.0-28-generic
```

本次生成的 initramfs 大约为 76 MB。

这里先单独生成 initramfs，是为了尽早恢复一个完整的启动组合。在继续处理软件包前，
仍然保留旧内核作为回退项。

### 2. 移除不兼容的 DKMS 模块

```bash
sudo apt-get remove -y apfs-dkms
```

这会移除实验性的 APFS 写入模块。如果机器确实依赖 APFS 挂载功能，不应直接照抄；
应先确认是否有兼容新内核的版本，或者暂时继续使用旧内核。

本次机器的根文件系统是 ext4，并不依赖 APFS 模块启动，因此可以安全移除。

### 3. 完成被中断的软件包配置

```bash
sudo dpkg --configure -a
```

修复后，相关软件包应全部变为 `ii`：

```bash
dpkg -l |
  grep -E 'linux-image-7.0|linux-headers-7.0|linux-generic-hwe'
```

结果：

```text
ii  linux-generic-hwe-24.04
ii  linux-headers-7.0.0-28-generic
ii  linux-image-7.0.0-28-generic
```

### 4. 重新生成 initramfs 和 GRUB 配置

```bash
sudo update-initramfs -u -k 7.0.0-28-generic
sudo update-grub
```

`update-grub` 应明确发现内核和对应的 initramfs：

```text
Found linux image: /boot/vmlinuz-7.0.0-28-generic
Found initrd image: /boot/initrd.img-7.0.0-28-generic
Found linux image: /boot/vmlinuz-6.17.0-35-generic
Found initrd image: /boot/initrd.img-6.17.0-35-generic
```

### 5. 临时显示 GRUB 菜单，保留回退能力

编辑 `/etc/default/grub`：

```ini
GRUB_DEFAULT=0
GRUB_TIMEOUT_STYLE=menu
GRUB_TIMEOUT=5
```

然后更新配置：

```bash
sudo update-grub
```

如果新内核仍然失败，重启时可以在 5 秒内选择旧内核。

## 重启验证

确认旧内核仍在 GRUB 中后执行：

```bash
sudo reboot
```

机器恢复在线后检查：

```bash
uname -r
uptime
cat /proc/cmdline
```

最终结果：

```text
7.0.0-28-generic
BOOT_IMAGE=/boot/vmlinuz-7.0.0-28-generic root=UUID=<根分区 UUID> ro quiet splash
```

机器成功通过 7.0 内核启动，SSH 恢复连接，故障解决。

## 根因链路

整个故障链路可以概括为：

```text
升级 HWE 内核
  → DKMS 为新内核编译第三方模块
  → linux-apfs-rw 与 7.0 内核不兼容
  → DKMS 返回失败
  → linux-image post-install 中断
  → 7.0 内核包处于 iF 状态
  → initrd.img-7.0.0-28-generic 缺失
  → GRUB 默认加载最新的 7.0 内核
  → 内核无法发现并挂载根文件系统
  → VFS: Unable to mount root fs on unknown-block(0,0)
```

## 避免再次发生

升级内核后、重启前建议执行以下检查：

```bash
# 是否存在未完成或损坏的软件包
sudo dpkg --audit

# 完成所有待配置的软件包
sudo dpkg --configure -a

# 检查 DKMS 是否在新内核上成功
dkms status

# 内核与 initramfs 是否成对存在
ls -lh /boot/vmlinuz* /boot/initrd.img*

# GRUB 是否同时发现内核和 initramfs
sudo update-grub
```

如果 `apt upgrade` 最后出现 DKMS、initramfs 或内核 post-install 错误，不要立即重启。
先解决报错并确认新内核的 `vmlinuz` 与 `initrd.img` 都存在。

同时建议至少保留一个已验证可启动的旧内核。新内核稳定运行一段时间后，再清理旧版本。

## 通用排障思路

并非所有 `unknown-block(0,0)` 都由 DKMS 引起，可以按以下顺序排查：

1. 在 GRUB 中尝试旧内核。
2. 检查 `/boot/vmlinuz-*` 与 `/boot/initrd.img-*` 是否成对存在。
3. 检查 `dpkg -l` 中是否存在 `iF`、`iU` 等异常状态。
4. 检查 `/var/log/apt/term.log` 和 DKMS 构建日志。
5. 检查 `/boot` 空间是否耗尽。
6. 对比 `blkid`、`/etc/fstab` 和内核 `root=UUID=` 参数。
7. 如果 Live USB 中也看不到磁盘，再检查 BIOS 的 AHCI/RAID 模式、NVMe、RAID 卡
   或物理硬件。
8. 如果使用 LVM、mdadm、LUKS 或特殊存储驱动，确认相关模块和 hook 已包含在
   initramfs 中。

本次案例最值得记住的不是“重建 initramfs”这一条命令，而是要继续追查为什么
initramfs 没有生成。只有解决造成内核安装中断的 DKMS 模块，软件包管理和后续内核
升级才会真正恢复正常。
