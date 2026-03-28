#define _GNU_SOURCE
#include <dlfcn.h>
#include <string.h>
#include <stdarg.h>
#include <fcntl.h>
#include <stdio.h>

#define FAKE_CPUINFO_PATH "/etc/cpuinfo.override"

typedef int (*orig_open_t)(const char *pathname, int flags, ...);
typedef FILE *(*orig_fopen_t)(const char *pathname, const char *mode);

int open(const char *pathname, int flags, ...) {
    orig_open_t orig_open = (orig_open_t)dlsym(RTLD_NEXT, "open");
    if (pathname && strcmp(pathname, "/proc/cpuinfo") == 0) {
        int fd = orig_open(FAKE_CPUINFO_PATH, O_RDONLY);
        if (fd >= 0) return fd;
    }
    va_list args;
    va_start(args, flags);
    int mode = va_arg(args, int);
    va_end(args);
    return orig_open(pathname, flags, mode);
}

int open64(const char *pathname, int flags, ...) {
    orig_open_t orig_open = (orig_open_t)dlsym(RTLD_NEXT, "open64");
    if (pathname && strcmp(pathname, "/proc/cpuinfo") == 0) {
        int fd = orig_open(FAKE_CPUINFO_PATH, O_RDONLY);
        if (fd >= 0) return fd;
    }
    va_list args;
    va_start(args, flags);
    int mode = va_arg(args, int);
    va_end(args);
    return orig_open(pathname, flags, mode);
}

FILE *fopen(const char *pathname, const char *mode) {
    orig_fopen_t orig_fopen = (orig_fopen_t)dlsym(RTLD_NEXT, "fopen");
    if (pathname && strcmp(pathname, "/proc/cpuinfo") == 0) {
        FILE *f = orig_fopen(FAKE_CPUINFO_PATH, mode);
        if (f) return f;
    }
    return orig_fopen(pathname, mode);
}

FILE *fopen64(const char *pathname, const char *mode) {
    orig_fopen_t orig_fopen = (orig_fopen_t)dlsym(RTLD_NEXT, "fopen64");
    if (pathname && strcmp(pathname, "/proc/cpuinfo") == 0) {
        FILE *f = orig_fopen(FAKE_CPUINFO_PATH, mode);
        if (f) return f;
    }
    return orig_fopen(pathname, mode);
}
