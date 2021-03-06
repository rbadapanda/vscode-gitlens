'use strict';
import { Strings } from '../../system';
import { Uri } from 'vscode';
import { GitCommit, GitCommitType } from './commit';
import { Git } from '../git';
import { GitStatusFileStatus, IGitStatusFile } from './status';
import * as path from 'path';

export class GitLogCommit extends GitCommit {

    nextSha?: string;
    nextFileName?: string;

    constructor(
        type: GitCommitType,
        repoPath: string,
        sha: string,
        author: string,
        email: string | undefined,
        date: Date,
        message: string,
        fileName: string,
        public readonly fileStatuses: IGitStatusFile[],
        public readonly status: GitStatusFileStatus | undefined,
        originalFileName: string | undefined,
        previousSha: string | undefined,
        previousFileName: string | undefined,
        public readonly parentShas?: string[]
    ) {
        super(
            type,
            repoPath,
            sha,
            author,
            email,
            date,
            message,
            fileName,
            originalFileName,
            previousSha,
            previousFileName
        );
    }

    get isMerge() {
        return this.parentShas && this.parentShas.length > 1;
    }

    get nextShortSha() {
        return this.nextSha && Git.shortenSha(this.nextSha);
    }

    get nextUri(): Uri {
        return this.nextFileName ? Uri.file(path.resolve(this.repoPath, this.nextFileName)) : this.uri;
    }

    get previousFileSha(): string {
        if (this._resolvedPreviousFileSha !== undefined) return this._resolvedPreviousFileSha;

        return (this.isFile && this.previousSha)
            ? this.previousSha
            : `${this.sha}^`;
    }

    getDiffStatus(): string {
        let added = 0;
        let deleted = 0;
        let changed = 0;

        for (const f of this.fileStatuses) {
            switch (f.status) {
                case 'A':
                case '?':
                    added++;
                    break;
                case 'D':
                    deleted++;
                    break;
                default:
                    changed++;
                    break;
            }
        }

        return `+${added} ~${changed} -${deleted}`;
    }

    toFileCommit(fileName: string): GitLogCommit | undefined;
    toFileCommit(status: IGitStatusFile): GitLogCommit;
    toFileCommit(fileNameOrStatus: string | IGitStatusFile): GitLogCommit | undefined {
        let status: IGitStatusFile | undefined;
        if (typeof fileNameOrStatus === 'string') {
            const fileName = Strings.normalizePath(path.relative(this.repoPath, fileNameOrStatus));
            status = this.fileStatuses.find(f => f.fileName === fileName);
            if (status === undefined) return undefined;
        }
        else {
            status = fileNameOrStatus;
        }

        // If this isn't a single-file commit, we can't trust the previousSha
        const previousSha = this.isFile
            ? this.previousSha
            : `${this.sha}^`;

        return this.with({
            type: this.isStash ? GitCommitType.StashFile : GitCommitType.File,
            fileName: status.fileName,
            originalFileName: status.originalFileName,
            previousSha: previousSha,
            previousFileName: status.originalFileName || status.fileName,
            status: status.status,
            fileStatuses: [status]
        });
    }

    with(changes: { type?: GitCommitType, sha?: string | null, fileName?: string, author?: string, email?: string, date?: Date, message?: string, originalFileName?: string | null, previousFileName?: string | null, previousSha?: string | null, status?: GitStatusFileStatus, fileStatuses?: IGitStatusFile[] | null }): GitLogCommit {
        return new GitLogCommit(
            changes.type || this.type,
            this.repoPath,
            this.getChangedValue(changes.sha, this.sha)!,
            changes.author || this.author,
            changes.email || this.email,
            changes.date || this.date,
            changes.message || this.message,
            changes.fileName || this.fileName,
            this.getChangedValue(changes.fileStatuses, this.fileStatuses) || [],
            changes.status || this.status,
            this.getChangedValue(changes.originalFileName, this.originalFileName),
            this.getChangedValue(changes.previousSha, this.previousSha),
            this.getChangedValue(changes.previousFileName, this.previousFileName),
            undefined
        );
    }
}