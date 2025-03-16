interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

interface DirectoryPickerOptions {
  mode?: 'read' | 'readwrite';
}

interface Window {
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemHandle>;
}
