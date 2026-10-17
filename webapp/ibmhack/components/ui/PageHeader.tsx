import type { ReactNode } from "react";
import styles from "./PageHeader.module.scss";

type Props = {
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
};

export default function PageHeader({ title, description, actions }: Props) {
    return (
        <header className={styles.header}>
            <div>
                <h1 className={styles.title}>{title}</h1>
                {description ? <p className={styles.description}>{description}</p> : null}
            </div>
            {actions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
    );
}
